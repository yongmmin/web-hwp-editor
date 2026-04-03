import JSZip from 'jszip';

/**
 * Export edited content back to HWPX format.
 *
 * Strategy:
 * - If we have the original HWPX zip data, clone it and replace section content
 * - Otherwise, create a minimal HWPX structure
 */
export async function exportToHwpx(
  html: string,
  originalZipData?: ArrayBuffer
): Promise<Blob> {
  if (originalZipData) {
    return exportWithOriginalStructure(html, originalZipData);
  }
  return exportMinimalHwpx(html);
}

async function exportWithOriginalStructure(
  html: string,
  originalZipData: ArrayBuffer
): Promise<Blob> {
  const zip = await JSZip.loadAsync(originalZipData);
  const sectionContent = htmlToHwpxSection(html);

  const sectionPaths: string[] = [];
  zip.forEach((path) => {
    if (path.match(/Contents\/sec\d+\.xml$/i) || path.match(/Contents\/section\d+\.xml$/i)) {
      sectionPaths.push(path);
    }
  });

  if (sectionPaths.length > 0) {
    zip.file(sectionPaths[0], sectionContent);
    for (let i = 1; i < sectionPaths.length; i++) {
      zip.remove(sectionPaths[i]);
    }
  } else {
    zip.file('Contents/sec0.xml', sectionContent);
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

async function exportMinimalHwpx(html: string): Promise<Blob> {
  const zip = new JSZip();

  zip.file('mimetype', 'application/hwp+zip');

  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="Contents/content.hpf" media-type="application/hwp+xml"/>
  </rootfiles>
</container>`);

  zip.file('Contents/content.hpf', `<?xml version="1.0" encoding="UTF-8"?>
<hp:package xmlns:hp="http://www.hancom.co.kr/hwpml/2011/package">
  <hp:mainSection href="sec0.xml"/>
</hp:package>`);

  zip.file('Contents/sec0.xml', htmlToHwpxSection(html));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// ──────────────────────────────────────────────
// HTML → HWPX XML 변환
// ──────────────────────────────────────────────

function htmlToHwpxSection(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  const xmlParts: string[] = [];
  convertNodes(div.childNodes, xmlParts);

  return `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">
${xmlParts.join('\n')}
</hs:sec>`;
}

function convertNodes(nodes: NodeListOf<ChildNode>, out: string[]): void {
  for (const node of Array.from(nodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        out.push(wrapParagraph([{ text, bold: false, italic: false, underline: false, strike: false, fontSize: 0 }]));
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'table') {
      out.push(convertTable(el));
    } else if (tag === 'p' || tag.match(/^h[1-6]$/)) {
      out.push(convertParagraph(el, tag));
    } else if (tag === 'section') {
      const regionBody = el.querySelector(':scope > .document-region-body');
      if (regionBody) {
        convertNodes(regionBody.childNodes, out);
      } else {
        convertNodes(el.childNodes, out);
      }
    } else if (tag === 'ul' || tag === 'ol') {
      convertList(el, out);
    } else if (tag === 'blockquote') {
      convertNodes(el.childNodes, out);
    } else if (tag === 'div') {
      if (el.classList.contains('document-region-label')) {
        continue;
      }
      convertNodes(el.childNodes, out);
    } else if (tag === 'br') {
      out.push(wrapParagraph([]));
    }
  }
}

// ── 문단 변환 ──

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  fontSize: number; // pt, 0 means default
}

function convertParagraph(el: HTMLElement, tag: string): string {
  const runs = extractRuns(el);
  if (runs.length === 0 && !el.textContent?.trim()) {
    return wrapParagraph([]);
  }

  // 제목 크기 매핑
  const headingSizes: Record<string, number> = {
    h1: 18, h2: 14, h3: 12, h4: 11, h5: 10, h6: 9,
  };

  if (headingSizes[tag]) {
    for (const run of runs) {
      run.bold = true;
      if (!run.fontSize) run.fontSize = headingSizes[tag];
    }
  }

  // 정렬
  const align = el.style?.textAlign || '';
  return wrapParagraph(runs, align);
}

function extractRuns(node: Node): TextRun[] {
  const runs: TextRun[] = [];
  collectRuns(node, runs, false, false, false, false, 0);
  return runs;
}

function collectRuns(
  node: Node,
  runs: TextRun[],
  bold: boolean,
  italic: boolean,
  underline: boolean,
  strike: boolean,
  fontSize: number,
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (text) {
      runs.push({ text, bold, italic, underline, strike, fontSize });
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  let b = bold, i = italic, u = underline, s = strike, fs = fontSize;
  if (tag === 'strong' || tag === 'b') b = true;
  if (tag === 'em' || tag === 'i') i = true;
  if (tag === 'u') u = true;
  if (tag === 's' || tag === 'del' || tag === 'strike') s = true;

  // font-size from style
  const style = el.getAttribute('style') || '';
  const fMatch = style.match(/font-size:\s*([\d.]+)pt/);
  if (fMatch) fs = parseFloat(fMatch[1]);

  for (const child of Array.from(el.childNodes)) {
    collectRuns(child, runs, b, i, u, s, fs);
  }
}

function wrapParagraph(runs: TextRun[], align?: string): string {
  if (runs.length === 0) {
    return '  <hp:p><hp:run><hp:t></hp:t></hp:run></hp:p>';
  }

  const alignAttr = align && align !== 'left'
    ? `\n      <hp:paraPr><hp:align horizontal="${escapeXml(align)}"/></hp:paraPr>`
    : '';

  const runXml = runs.map((run) => {
    const prParts: string[] = [];
    if (run.bold) prParts.push('<hp:bold/>');
    if (run.italic) prParts.push('<hp:italic/>');
    if (run.underline) prParts.push('<hp:underline/>');
    if (run.strike) prParts.push('<hp:strikethrough/>');
    if (run.fontSize > 0) prParts.push(`<hp:sz val="${Math.round(run.fontSize * 100)}"/>`);

    const rPr = prParts.length > 0
      ? `\n        <hp:rPr>${prParts.join('')}</hp:rPr>`
      : '';

    return `      <hp:run>${rPr}
        <hp:t>${escapeXml(run.text)}</hp:t>
      </hp:run>`;
  }).join('\n');

  return `  <hp:p>${alignAttr}
${runXml}
  </hp:p>`;
}

// ── 테이블 변환 ──

function convertTable(table: HTMLElement): string {
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return '';

  const trXml: string[] = [];

  for (const tr of Array.from(rows)) {
    const cells = tr.querySelectorAll('td, th');
    const tcXml: string[] = [];

    for (const cell of Array.from(cells)) {
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);

      const cellParts: string[] = [];
      // 셀 내 블록 요소 변환
      const blockEls = cell.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
      if (blockEls.length > 0) {
        for (const block of Array.from(blockEls)) {
          cellParts.push(convertParagraph(block as HTMLElement, block.tagName.toLowerCase()));
        }
      } else {
        // 블록 요소가 없으면 직접 텍스트 추출
        const runs = extractRuns(cell);
        cellParts.push(wrapParagraph(runs.length > 0 ? runs : [{ text: cell.textContent || '', bold: false, italic: false, underline: false, strike: false, fontSize: 0 }]));
      }

      const attrs: string[] = [];
      if (colspan > 1) attrs.push(`colspan="${colspan}"`);
      if (rowspan > 1) attrs.push(`rowspan="${rowspan}"`);
      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

      tcXml.push(`      <hp:tc${attrStr}>\n${cellParts.join('\n')}\n      </hp:tc>`);
    }

    trXml.push(`    <hp:tr>\n${tcXml.join('\n')}\n    </hp:tr>`);
  }

  return `  <hp:tbl>\n${trXml.join('\n')}\n  </hp:tbl>`;
}

// ── 리스트 변환 ──

function convertList(list: HTMLElement, out: string[]): void {
  const items = list.querySelectorAll(':scope > li');
  for (const li of Array.from(items)) {
    const prefix = list.tagName.toLowerCase() === 'ol'
      ? `${Array.from(items).indexOf(li) + 1}. `
      : '• ';
    const runs = extractRuns(li);
    if (runs.length > 0) {
      runs[0].text = prefix + runs[0].text;
    } else {
      runs.push({ text: prefix + (li.textContent || ''), bold: false, italic: false, underline: false, strike: false, fontSize: 0 });
    }
    out.push(wrapParagraph(runs));
  }
}

// ── 유틸 ──

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
