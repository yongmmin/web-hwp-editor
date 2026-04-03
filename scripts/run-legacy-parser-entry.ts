import { readFile, writeFile } from 'node:fs/promises';
import { parseHwpLegacy } from '../src/services/hwp/hwpLegacyParser';

if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = ((s: string) => Buffer.from(s, 'binary').toString('base64')) as typeof globalThis.btoa;
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('Usage: node run-legacy-parser.cjs <input.hwp> <output.html>');
    process.exit(1);
  }

  const raw = await readFile(inputPath);
  const u8 = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  const parsed = await parseHwpLegacy(ab);
  await writeFile(outputPath, parsed.html, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
