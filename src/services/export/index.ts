import type { Editor, JSONContent } from '@tiptap/react';
import type { ParsedDocument } from '../../types';
import { writeHwpx, recollectHwpxMeta } from './hwpxWriter';
import { writeHwp5, recollectHwp5Meta } from './hwp5Writer';

/**
 * Single entry point for document export (download).
 *
 * Fidelity strategy: keep the original bytes intact and patch only
 * edited paragraphs in place. HWPX rewrites section XML inside the
 * original zip; HWP5 patches BodyText records inside the original
 * OLE2 compound file. No format conversion, no regeneration.
 */
export async function exportDocument(
  editor: Editor,
  doc: ParsedDocument
): Promise<{ blob: Blob; format: 'hwp' | 'hwpx' }> {
  const json = editor.getJSON();

  if (doc.originalFormat === 'hwpx') {
    if (!doc.rawZipData) {
      throw new Error('HWPX 내보내기: 원본 zip 데이터가 없습니다.');
    }
    const blob = await writeHwpx(json, doc.rawZipData, doc.hwpxExportMeta);
    return { blob, format: 'hwpx' };
  }

  if (doc.originalFormat === 'hwp') {
    if (!doc.rawHwpBuffer) {
      throw new Error('HWP 내보내기: 원본 바이너리가 없습니다.');
    }
    const blob = await writeHwp5(json, doc.rawHwpBuffer, doc.hwp5ExportMeta);
    return { blob, format: 'hwp' };
  }

  throw new Error(`지원하지 않는 포맷: ${doc.originalFormat}`);
}

/**
 * Save edits into the document's in-memory binary buffer.
 *
 * Runs the same export pipeline, then writes the patched bytes back into
 * `rawHwpBuffer` / `rawZipData` and re-collects export metadata so byte
 * offsets stay in sync with the updated binary. The returned partial
 * document should be merged into the store by the caller.
 */
export async function saveDocumentInPlace(
  editor: Editor,
  doc: ParsedDocument
): Promise<Partial<ParsedDocument>> {
  const { blob, format } = await exportDocument(editor, doc);
  const newBuffer = await blob.arrayBuffer();
  const html = editor.getHTML();

  if (format === 'hwp') {
    const baseMeta = recollectHwp5Meta(newBuffer);
    // Re-snapshot editor texts so the next save/export diffs against
    // this save point rather than the original upload.
    const json = editor.getJSON();
    const editorOriginalTexts = collectTextsFromJson(json);
    const hwp5ExportMeta = { ...baseMeta, editorOriginalTexts };
    return { html, rawHwpBuffer: newBuffer, hwp5ExportMeta };
  }

  if (format === 'hwpx') {
    const hwpxExportMeta = await recollectHwpxMeta(newBuffer);
    return { html, rawZipData: newBuffer, hwpxExportMeta };
  }

  return { html };
}

/** Walk TipTap JSON and return plain text per paragraph/heading. */
function collectTextsFromJson(json: JSONContent): string[] {
  const out: string[] = [];
  walk(json);
  return out;

  function walk(node: JSONContent | undefined): void {
    if (!node) return;
    if (node.type === 'paragraph' || node.type === 'heading') {
      out.push(textOf(node));
      return;
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  }

  function textOf(node: JSONContent): string {
    if (node.type === 'text' && typeof node.text === 'string') return node.text;
    if (!Array.isArray(node.content)) return '';
    let s = '';
    for (const child of node.content) s += textOf(child);
    return s;
  }
}
