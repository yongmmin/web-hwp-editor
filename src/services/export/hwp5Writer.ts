import CFB from 'cfb';
import pako from 'pako';
import type { JSONContent } from '@tiptap/react';
import type { Hwp5ExportMeta } from '../../types';
import {
  readRecordHeaders,
  writeRecordHeader,
  recordTotalSize,
  TAG_PARA_HEADER,
  TAG_PARA_TEXT,
} from './hwp5Records';

/**
 * HWP5 writer — patches BodyText records inside the original OLE2 file.
 *
 * 전략 (최소 동작 스코프):
 *  - 원본 OLE2 바이너리를 cfb로 로드
 *  - 각 /BodyText/Section# 스트림을 pako로 inflateRaw (압축 여부는 FileHeader
 *    플래그로 판정)
 *  - meta.paragraphs가 기록한 바이트 범위를 기준으로 단락을 순회
 *  - TipTap JSON의 단락 순서와 HWP5 단락 수가 **정확히 일치**할 때만 패치
 *    (insert/delete는 후속 iteration 과제 — 현재는 안전하게 원본 유지)
 *  - 패치 대상 단락이 아래 조건을 모두 만족할 때만 실제 교체:
 *       · hasControls === false (표·이미지·컨트롤 없음)
 *       · PARA_TEXT 레코드가 정확히 1개
 *       · 원본 PARA_TEXT 안에 제어 코드 없음 (0x09/0x0A 제외한 U+0000..U+001F)
 *       · 원본과 새 텍스트가 실제로 다름
 *  - 패치 내용:
 *       · PARA_TEXT 레코드 payload를 새 UTF-16LE 바이트로 교체, size 필드 갱신
 *       · PARA_HEADER 첫 4바이트(nChars)를 새 텍스트 길이로 갱신
 *       · LINE_SEG는 건드리지 않음 → 한글 뷰어가 자동 reflow
 *  - 스트림을 다시 pako.deflateRaw 후 cfb.write로 OLE2 재직렬화
 */

const UTF16LE_DECODER = new TextDecoder('utf-16le');

export async function writeHwp5(
  json: JSONContent,
  originalBuffer: ArrayBuffer,
  meta: Hwp5ExportMeta | undefined
): Promise<Blob> {
  if (!meta || meta.sections.length === 0) {
    console.warn('[hwp5Writer] meta 없음 — 원본 그대로 반환');
    return new Blob([originalBuffer], { type: 'application/x-hwp' });
  }

  const edited = collectEditedParagraphs(json);
  const origCount = meta.sections.reduce((s, sec) => s + sec.paragraphs.length, 0);

  if (edited.length !== origCount) {
    console.warn(
      `[hwp5Writer] paragraph count mismatch: editor=${edited.length} hwp5=${origCount}. ` +
        `Returning original bytes unchanged. (insert/delete는 다음 이터레이션)`
    );
    return new Blob([originalBuffer], { type: 'application/x-hwp' });
  }

  const cfb = CFB.read(new Uint8Array(originalBuffer), { type: 'array' });
  const compressed = isHwpCompressed(cfb);

  let editedCursor = 0;
  let anyChanges = false;

  for (const sec of meta.sections) {
    const rawStream = getStreamBytes(cfb, sec.streamPath);
    if (!rawStream) {
      editedCursor += sec.paragraphs.length;
      continue;
    }

    const decompressed = compressed ? pako.inflateRaw(rawStream) : rawStream;

    const parts: Uint8Array[] = [];
    let cursor = 0;
    let sectionDirty = false;

    for (const block of sec.paragraphs) {
      if (block.startOffset > cursor) {
        parts.push(decompressed.slice(cursor, block.startOffset));
      }

      const origBlock = decompressed.slice(block.startOffset, block.endOffset);
      const editedPara = edited[editedCursor++];

      if (block.hasControls) {
        // 표/이미지 포함 단락은 안전하게 원본 유지
        parts.push(origBlock);
      } else {
        const patched = tryPatchParagraphBlock(origBlock, editedPara.text);
        if (patched) {
          parts.push(patched);
          sectionDirty = true;
        } else {
          parts.push(origBlock);
        }
      }

      cursor = block.endOffset;
    }

    // 남은 trailing 바이트 (마지막 단락 이후의 non-paragraph 레코드)
    if (cursor < decompressed.length) {
      parts.push(decompressed.slice(cursor));
    }

    if (sectionDirty) {
      const newDecompressed = concatUint8(parts);
      const newStream = compressed ? pako.deflateRaw(newDecompressed) : newDecompressed;
      replaceStreamContent(cfb, sec.streamPath, newStream);
      anyChanges = true;
    }
  }

  if (!anyChanges) {
    return new Blob([originalBuffer], { type: 'application/x-hwp' });
  }

  const outBytes = CFB.write(cfb, { type: 'array' }) as unknown as ArrayLike<number>;
  const buf = outBytes instanceof Uint8Array ? outBytes : new Uint8Array(outBytes);
  return new Blob([buf], { type: 'application/x-hwp' });
}

// ─── CFB helpers ─────────────────────────────────────────────────────────────

function isHwpCompressed(cfb: CFB.CFB$Container): boolean {
  const fh = CFB.find(cfb, '/FileHeader');
  if (!fh?.content || fh.content.length < 37) return true;
  const content = asUint8(fh.content);
  return (content[36] & 0x01) !== 0;
}

function getStreamBytes(
  cfb: CFB.CFB$Container,
  path: string
): Uint8Array | null {
  const entry = CFB.find(cfb, path);
  if (!entry?.content) return null;
  return asUint8(entry.content);
}

function replaceStreamContent(
  cfb: CFB.CFB$Container,
  path: string,
  newContent: Uint8Array
): void {
  const entry = CFB.find(cfb, path);
  if (!entry) return;
  // cfb stores content as an array-like; writing back a Uint8Array is accepted.
  entry.content = newContent;
  if (typeof (entry as { size?: number }).size === 'number') {
    (entry as { size: number }).size = newContent.length;
  }
}

function asUint8(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data as number[]);
  return new Uint8Array(0);
}

// ─── TipTap JSON helpers ────────────────────────────────────────────────────

interface EditedParagraph {
  text: string;
}

function collectEditedParagraphs(json: JSONContent): EditedParagraph[] {
  const out: EditedParagraph[] = [];
  walk(json);
  return out;

  function walk(node: JSONContent | undefined): void {
    if (!node) return;

    if (node.type === 'paragraph' || node.type === 'heading') {
      const text = collectText(node);
      out.push({ text });
      return;
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  }

  function collectText(node: JSONContent): string {
    if (node.type === 'text' && typeof node.text === 'string') return node.text;
    if (!Array.isArray(node.content)) return '';
    let s = '';
    for (const child of node.content) s += collectText(child);
    return s;
  }
}

// ─── Paragraph block patching ───────────────────────────────────────────────

/**
 * Given the raw bytes of a single top-level paragraph (starting at its
 * PARA_HEADER record) and the new plain text, return patched bytes or null
 * when patching is not safe / not needed.
 */
function tryPatchParagraphBlock(
  origBlock: Uint8Array,
  newText: string
): Uint8Array | null {
  const headers = readRecordHeaders(origBlock);
  if (headers.length === 0) return null;

  // The first record must be the PARA_HEADER at offset 0 with level 0.
  const paraHeader = headers[0];
  if (paraHeader.tagId !== TAG_PARA_HEADER || paraHeader.level !== 0) return null;

  const textRecords = headers.filter(
    (r) => r.tagId === TAG_PARA_TEXT && r.level === 1
  );
  if (textRecords.length !== 1) return null;

  const textRec = textRecords[0];
  const origTextBytes = origBlock.subarray(
    textRec.dataOffset,
    textRec.dataOffset + textRec.size
  );

  if (hasControlCodes(origTextBytes)) return null;

  // Preserve trailing line-break char (0x0A) — the HWP storage format
  // typically ends each paragraph with one. Strip for the comparison and
  // re-append for the rewrite.
  const origText = decodeUtf16Le(origTextBytes);
  const trailingNewline = origText.endsWith('\n');
  const origTextBare = trailingNewline ? origText.slice(0, -1) : origText;

  if (origTextBare === newText) return null;

  const newTextWithTail = trailingNewline ? newText + '\n' : newText;
  const newTextBytes = encodeUtf16Le(newTextWithTail);

  return rebuildParagraphBlock(origBlock, headers, textRec, newTextBytes, newTextWithTail.length);
}

/**
 * Walk the original byte stream of a paragraph block and emit a new stream
 * with:
 *   - PARA_HEADER re-emitted with its nChars (data offset 0) updated
 *   - The single PARA_TEXT record re-emitted with the new payload + size
 *   - All other records copied byte-for-byte
 */
function rebuildParagraphBlock(
  origBlock: Uint8Array,
  headers: ReturnType<typeof readRecordHeaders>,
  textRec: (typeof headers)[number],
  newTextBytes: Uint8Array,
  newNChars: number
): Uint8Array {
  // Precompute the output size.
  let outSize = 0;
  for (const rec of headers) {
    if (rec === textRec) {
      outSize += recordTotalSize(newTextBytes.length);
    } else {
      outSize += rec.headerSize + rec.size;
    }
  }
  // Include any trailing bytes beyond the last record (rare — padding).
  const lastRec = headers[headers.length - 1];
  const recordsEnd = lastRec.dataOffset + lastRec.size;
  const trailing = origBlock.length - recordsEnd;
  if (trailing > 0) outSize += trailing;

  const out = new Uint8Array(outSize);
  let writeOff = 0;

  for (const rec of headers) {
    if (rec === textRec) {
      // Emit new PARA_TEXT header + payload.
      const headerLen = writeRecordHeader(
        out,
        writeOff,
        rec.tagId,
        rec.level,
        newTextBytes.length
      );
      writeOff += headerLen;
      out.set(newTextBytes, writeOff);
      writeOff += newTextBytes.length;
      continue;
    }

    // Copy the record header + payload verbatim.
    const recBytes = origBlock.subarray(
      rec.headerOffset,
      rec.dataOffset + rec.size
    );
    out.set(recBytes, writeOff);

    // For PARA_HEADER, patch nChars (first u32 of the payload).
    if (rec.tagId === TAG_PARA_HEADER && rec.level === 0 && rec.size >= 4) {
      const payloadStart = writeOff + rec.headerSize;
      out[payloadStart] = newNChars & 0xff;
      out[payloadStart + 1] = (newNChars >>> 8) & 0xff;
      out[payloadStart + 2] = (newNChars >>> 16) & 0xff;
      out[payloadStart + 3] = (newNChars >>> 24) & 0xff;
    }

    writeOff += rec.headerSize + rec.size;
  }

  if (trailing > 0) {
    out.set(origBlock.subarray(recordsEnd), writeOff);
  }

  return out;
}

// ─── text encoding / inspection ─────────────────────────────────────────────

function hasControlCodes(bytes: Uint8Array): boolean {
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      return true;
    }
  }
  return false;
}

function decodeUtf16Le(bytes: Uint8Array): string {
  try {
    return UTF16LE_DECODER.decode(bytes);
  } catch {
    let s = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      s += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
    }
    return s;
  }
}

function encodeUtf16Le(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = (code >>> 8) & 0xff;
  }
  return out;
}

function concatUint8(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
