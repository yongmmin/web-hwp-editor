import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function usage() {
  console.log('Usage: node scripts/regression-hwp.mjs <hwp-dir>');
}

async function listHwpFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isDirectory()) continue;
    if (!e.name.toLowerCase().endsWith('.hwp')) continue;
    files.push(path.join(dir, e.name));
  }
  return files.sort();
}

function safeParseJsonBlock(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    usage();
    process.exit(1);
  }

  const files = await listHwpFiles(dir);
  if (files.length === 0) {
    console.log('No .hwp files found');
    return;
  }

  const results = [];
  for (const file of files) {
    try {
      const { stdout } = await execFileAsync('node', ['scripts/hwp-quality-report.mjs', file], {
        maxBuffer: 16 * 1024 * 1024,
      });
      const report = safeParseJsonBlock(stdout);
      if (!report) throw new Error('invalid report json');
      results.push({ file, ok: true, score: report.score, report });
      console.log(`[OK] ${path.basename(file)} score=${report.score}`);
    } catch (error) {
      results.push({ file, ok: false, error: error instanceof Error ? error.message : String(error) });
      console.log(`[FAIL] ${path.basename(file)}`);
    }
  }

  const ok = results.filter((r) => r.ok);
  const avgScore = ok.length ? Number((ok.reduce((s, r) => s + r.score, 0) / ok.length).toFixed(4)) : 0;
  const summary = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: ok.length,
    failed: results.length - ok.length,
    avgScore,
    results,
  };

  const outPath = path.resolve('docs', 'quality-regression.latest.json');
  await writeFile(outPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\nSaved regression: ${outPath}`);
  console.log(JSON.stringify({
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    avgScore: summary.avgScore,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
