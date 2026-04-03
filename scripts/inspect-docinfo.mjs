import fs from 'node:fs';
import CFB from 'cfb';
import pako from 'pako';

const TAG_BORDER_FILL = 20;
const TAG_CHAR_SHAPE = 21;
const TAG_PARA_SHAPE = 25;
const TAG_LIST_HEADER = 72;

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/inspect-docinfo.mjs <path-to-hwp>');
  process.exit(1);
}

function u32(d, o) {
  return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
}

function i32(d, o) {
  const v = u32(d, o);
  return v > 0x7fffffff ? v - 0x100000000 : v;
}

function u16(d, o) {
  return d[o] | (d[o + 1] << 8);
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

function readRecords(data) {
  const out = [];
  let off = 0;
  while (off < data.length - 3) {
    const h = u32(data, off);
    off += 4;
    const tagId = h & 0x3ff;
    const level = (h >>> 10) & 0x3ff;
    let size = (h >>> 20) & 0xfff;
    if (size === 0xfff) {
      if (off + 4 > data.length) break;
      size = u32(data, off);
      off += 4;
    }
    if (off + size > data.length) break;
    out.push({ tagId, level, data, offset: off, size });
    off += size;
  }
  return out;
}

function getStream(cfb, path, compressed) {
  const entry = CFB.find(cfb, path);
  if (!entry?.content) return null;
  const raw = entry.content instanceof Uint8Array ? entry.content : new Uint8Array(entry.content);
  return compressed ? decompress(raw) : raw;
}

function hexDump(d, o, size) {
  const end = Math.min(o + size, d.length);
  const parts = [];
  for (let i = o; i < end; i++) parts.push(d[i].toString(16).padStart(2, '0'));
  return parts.join(' ');
}

const raw = fs.readFileSync(filePath);
const cfb = CFB.read(new Uint8Array(raw), { type: 'buffer' });
const fh = CFB.find(cfb, '/FileHeader');
const compressed = !fh?.content || fh.content.length < 37 ? true : (fh.content[36] & 0x01) !== 0;
const docInfoEntry = CFB.find(cfb, '/DocInfo');
if (!docInfoEntry?.content) {
  console.error('No /DocInfo stream found');
  process.exit(2);
}
const docInfoRaw = docInfoEntry.content instanceof Uint8Array ? docInfoEntry.content : new Uint8Array(docInfoEntry.content);
const docInfo = compressed ? decompress(docInfoRaw) : docInfoRaw;
const recs = readRecords(docInfo);

const charShapes = recs.filter((r) => r.tagId === TAG_CHAR_SHAPE);
const paraShapes = recs.filter((r) => r.tagId === TAG_PARA_SHAPE);
const borderFills = recs.filter((r) => r.tagId === TAG_BORDER_FILL);
const offsetFreq = (records, off) => {
  const m = new Map();
  for (const r of records) {
    if (r.size < off + 4) continue;
    const v = u32(r.data, r.offset + off);
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
};

console.log('counts', {
  total: recs.length,
  charShapes: charShapes.length,
  paraShapes: paraShapes.length,
  borderFills: borderFills.length,
});

console.log('\nCHAR_SHAPE offset frequencies');
for (const off of [46, 50, 54, 58, 62, 66, 70]) {
  console.log(`offset ${off}:`, offsetFreq(charShapes, off));
}

console.log('\nBORDER_FILL offset frequencies');
for (const off of [8, 12, 16, 20, 24, 28, 32, 36, 40, 44]) {
  console.log(`offset ${off}:`, offsetFreq(borderFills, off));
}

console.log('\nCHAR_SHAPE sample');
for (let i = 0; i < Math.min(charShapes.length, 12); i++) {
  const r = charShapes[i];
  const d = r.data;
  const o = r.offset;
  const row = {
    idx: i,
    size: r.size,
    height42: r.size >= 46 ? u32(d, o + 42) : null,
    props46: r.size >= 50 ? u32(d, o + 46) : null,
    color58: r.size >= 62 ? u32(d, o + 58) : null,
    color62: r.size >= 66 ? u32(d, o + 62) : null,
    color66: r.size >= 70 ? u32(d, o + 66) : null,
    color70: r.size >= 74 ? u32(d, o + 70) : null,
    color74: r.size >= 78 ? u32(d, o + 74) : null,
    color78: r.size >= 82 ? u32(d, o + 78) : null,
  };
  console.log(row);
  console.log('  hex0-96:', hexDump(d, o, Math.min(96, r.size)));
}

console.log('\nPARA_SHAPE sample');
for (let i = 0; i < Math.min(paraShapes.length, 12); i++) {
  const r = paraShapes[i];
  const d = r.data;
  const o = r.offset;
  const row = {
    idx: i,
    size: r.size,
    align: r.size >= 4 ? (u32(d, o) & 7) : null,
    indent: r.size >= 24 ? i32(d, o + 20) : null,
    marginLeft: r.size >= 8 ? i32(d, o + 4) : null,
    marginRight: r.size >= 12 ? i32(d, o + 8) : null,
    marginTop: r.size >= 16 ? i32(d, o + 12) : null,
    marginBottom: r.size >= 20 ? i32(d, o + 16) : null,
    lineSpacingLike: r.size >= 32 ? i32(d, o + 28) : null,
  };
  console.log(row);
  console.log('  hex0-80:', hexDump(d, o, Math.min(80, r.size)));
}

console.log('\nBORDER_FILL sample');
for (let i = 0; i < Math.min(borderFills.length, 12); i++) {
  const r = borderFills[i];
  const d = r.data;
  const o = r.offset;
  const row = {
    idx: i,
    size: r.size,
    u16_0: r.size >= 2 ? u16(d, o) : null,
    u16_2: r.size >= 4 ? u16(d, o + 2) : null,
    u16_4: r.size >= 6 ? u16(d, o + 4) : null,
    u16_6: r.size >= 8 ? u16(d, o + 6) : null,
    color8: r.size >= 12 ? u32(d, o + 8) : null,
    color12: r.size >= 16 ? u32(d, o + 12) : null,
    color16: r.size >= 20 ? u32(d, o + 16) : null,
    color20: r.size >= 24 ? u32(d, o + 20) : null,
    color24: r.size >= 28 ? u32(d, o + 24) : null,
    color28: r.size >= 32 ? u32(d, o + 28) : null,
  };
  console.log(row);
  console.log('  hex0-96:', hexDump(d, o, Math.min(96, r.size)));
}

const section0 = getStream(cfb, '/BodyText/Section0', compressed);
if (section0) {
  const secRecs = readRecords(section0);
  const listHeaders = secRecs.filter((r) => r.tagId === TAG_LIST_HEADER);
  console.log('\nLIST_HEADER sample');
  console.log('listHeaderCount', listHeaders.length);
  for (let i = 0; i < Math.min(listHeaders.length, 20); i++) {
    const r = listHeaders[i];
    const vals = [];
    for (const off of [8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52]) {
      if (r.size >= off + 4) vals.push(`${off}:${u32(r.data, r.offset + off)}`);
    }
    console.log(`idx=${i} size=${r.size} ${vals.join(' ')}`);
  }

  const borderCount = borderFills.length;
  console.log('\nLIST_HEADER candidate border-fill refs (u16)');
  for (const off of [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42]) {
    const freq = new Map();
    let inRange = 0;
    let total = 0;
    for (const r of listHeaders) {
      if (r.size < off + 2) continue;
      const v = u16(r.data, r.offset + off);
      total++;
      freq.set(v, (freq.get(v) ?? 0) + 1);
      if (v >= 1 && v <= borderCount) inRange++;
    }
    const top = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`off=${off} inRange=${inRange}/${total} top=${JSON.stringify(top)}`);
  }
}
