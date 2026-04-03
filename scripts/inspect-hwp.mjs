import fs from 'node:fs';
import CFB from 'cfb';
import pako from 'pako';

const TAG_PARA_HEADER = 66;
const TAG_CTRL_HEADER = 71;
const TAG_LIST_HEADER = 72;
const TAG_TABLE = 77;
const TAG_SHAPE_COMPONENT = 76;
const TAG_SHAPE_PICTURE = 85;

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/inspect-hwp.mjs <path-to-hwp>');
  process.exit(1);
}

function u16(d, o) {
  return d[o] | (d[o + 1] << 8);
}

function u32(d, o) {
  return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
}

function i32(d, o) {
  const v = u32(d, o);
  return v > 0x7fffffff ? v - 0x100000000 : v;
}

function getCtrlId(rec) {
  if (rec.size < 4) return '';
  const d = rec.data;
  const o = rec.offset;
  return String.fromCharCode(d[o + 3], d[o + 2], d[o + 1], d[o]);
}

function decompress(raw) {
  try {
    return pako.inflateRaw(raw);
  } catch {}
  try {
    return pako.inflate(raw);
  } catch {}
  return raw;
}

function getStream(cfb, path, compressed) {
  const entry = CFB.find(cfb, path);
  if (!entry?.content) return null;
  const raw = entry.content instanceof Uint8Array ? entry.content : new Uint8Array(entry.content);
  return compressed ? decompress(raw) : raw;
}

function readRecords(data) {
  const recs = [];
  let off = 0;
  while (off < data.length - 3) {
    const header = u32(data, off);
    off += 4;
    const tagId = header & 0x3ff;
    const level = (header >>> 10) & 0x3ff;
    let size = (header >>> 20) & 0xfff;
    if (size === 0xfff) {
      if (off + 4 > data.length) break;
      size = u32(data, off);
      off += 4;
    }
    if (off + size > data.length) break;
    recs.push({ tagId, level, data, offset: off, size });
    off += size;
  }
  return recs;
}

function findChildrenEnd(recs, start, baseLevel) {
  let i = start;
  while (i < recs.length && recs[i].level > baseLevel) i++;
  return i;
}

function hwpUnitToPx(v) {
  if (!Number.isFinite(v) || v <= 0) return null;
  const px = Math.round(v / 75);
  if (px <= 0 || px > 10000) return null;
  return px;
}

const raw = fs.readFileSync(filePath);
const cfb = CFB.read(new Uint8Array(raw), { type: 'buffer' });
const fh = CFB.find(cfb, '/FileHeader');
const compressed = !fh?.content || fh.content.length < 37 ? true : (fh.content[36] & 0x01) !== 0;

const summary = {
  sections: 0,
  paras: 0,
  tables: 0,
  cells: 0,
  gso: 0,
  images: 0,
};

const gsoRows = [];
const ctrlIdCounts = new Map();

for (let section = 0; section < 256; section++) {
  const data = getStream(cfb, `/BodyText/Section${section}`, compressed);
  if (!data) break;
  summary.sections++;

  const recs = readRecords(data);

  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (rec.tagId === TAG_PARA_HEADER && rec.level === 0) summary.paras++;
    if (rec.tagId === TAG_TABLE) summary.tables++;
    if (rec.tagId === TAG_LIST_HEADER) summary.cells++;
    if (rec.tagId === TAG_CTRL_HEADER) {
      const id = getCtrlId(rec);
      ctrlIdCounts.set(id, (ctrlIdCounts.get(id) ?? 0) + 1);
    }

    if (rec.tagId === TAG_CTRL_HEADER && getCtrlId(rec) === 'gso ') {
      summary.gso++;
      const childEnd = findChildrenEnd(recs, i + 1, rec.level);
      let imageId = null;
      let shapeWidthPx = null;
      let shapeHeightPx = null;
      let xLike = null;
      let yLike = null;
      const ctrlA = rec.size >= 8 ? u32(rec.data, rec.offset + 4) : 0;
      const ctrlB = rec.size >= 12 ? u32(rec.data, rec.offset + 8) : 0;
      const ctrlC = rec.size >= 16 ? u32(rec.data, rec.offset + 12) : 0;
      const ctrlD = rec.size >= 20 ? u32(rec.data, rec.offset + 16) : 0;

      for (let j = i + 1; j < childEnd; j++) {
        const c = recs[j];
        if (c.tagId === TAG_SHAPE_PICTURE && c.size >= 72) {
          const packed = u16(c.data, c.offset + 70);
          imageId = packed >>> 8;
        }
        if (c.tagId === TAG_SHAPE_COMPONENT && c.size >= 36) {
          shapeWidthPx = hwpUnitToPx(u32(c.data, c.offset + 28));
          shapeHeightPx = hwpUnitToPx(u32(c.data, c.offset + 32));
          xLike = hwpUnitToPx(Math.abs(i32(c.data, c.offset + 20)));
          yLike = hwpUnitToPx(Math.abs(i32(c.data, c.offset + 24)));
        }
      }

      if (imageId && imageId > 0) summary.images++;
      gsoRows.push({
        section,
        recIndex: i,
        imageId,
        w: shapeWidthPx,
        h: shapeHeightPx,
        x: xLike,
        y: yLike,
        a: ctrlA,
        b: ctrlB,
        c: ctrlC,
        d: ctrlD,
      });
    }
  }
}

console.log('Summary:', summary);
console.log('CTRL_HEADER IDs:', Array.from(ctrlIdCounts.entries()).sort((a, b) => b[1] - a[1]));
console.log('First 40 GSO rows:');
for (const row of gsoRows.slice(0, 40)) {
  console.log(
    `sec=${row.section} rec=${row.recIndex} img=${row.imageId ?? 0} size=${row.w ?? 0}x${row.h ?? 0} pos~=${row.x ?? 0},${row.y ?? 0} ctrl=${row.a}/${row.b}/${row.c}/${row.d}`
  );
}
