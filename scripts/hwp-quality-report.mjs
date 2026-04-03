import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);
const HWP5HTML_BIN = process.env.HWP5HTML_BIN || '/Users/iyongmin/Library/Python/3.10/bin/hwp5html';
const ESBUILD_BIN = path.resolve('node_modules/.bin/esbuild');
const RUNNER_BUNDLE = path.join(os.tmpdir(), 'hwp-legacy-runner.cjs');

function usage() {
  console.log('Usage: node scripts/hwp-quality-report.mjs <path-to-hwp>');
}

function metricsFromHtml(html) {
  const body = extractBodyHtml(html);
  const text = body
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    htmlLength: body.length,
    textLength: text.length,
    tables: (body.match(/<table\b/gi) || []).length,
    rows: (body.match(/<tr\b/gi) || []).length,
    cells: (body.match(/<t[dh]\b/gi) || []).length,
    images: (body.match(/<img\b/gi) || []).length,
    paragraphs: (body.match(/<p\b/gi) || []).length,
    pageBreaks: (body.match(/hwp-page-break|class="Page"/gi) || []).length,
    hasInlineStyleRatio: ((body.match(/\sstyle="/gi) || []).length) / Math.max((body.match(/<[^/!][^>]*>/g) || []).length, 1),
  };
}

function ratioScore(a, b) {
  if (a === 0 && b === 0) return 1;
  return Math.max(0, 1 - Math.abs(a - b) / Math.max(a, b, 1));
}

function overallScore(ref, cur) {
  const keys = ['tables', 'rows', 'cells', 'images', 'paragraphs', 'pageBreaks', 'textLength'];
  const scores = keys.map((k) => ratioScore(ref[k], cur[k]));
  const stylePenalty = Math.min(0.2, Math.abs((ref.hasInlineStyleRatio || 0) - (cur.hasInlineStyleRatio || 0)));
  return Number(Math.max(0, (scores.reduce((s, v) => s + v, 0) / scores.length) - stylePenalty).toFixed(4));
}

function extractBodyHtml(html) {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return (m ? m[1] : html).trim();
}

async function ensureRunnerBundle() {
  const entryPath = path.resolve('scripts/run-legacy-parser-entry.ts');
  const needBuild = !existsSync(RUNNER_BUNDLE)
    || (await stat(RUNNER_BUNDLE)).mtimeMs < (await stat(entryPath)).mtimeMs
    || (await stat(RUNNER_BUNDLE)).mtimeMs < (await stat(path.resolve('src/services/hwp/hwpLegacyParser.ts'))).mtimeMs;

  if (!needBuild) return;

  await execFileAsync(ESBUILD_BIN, [
    entryPath,
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--outfile=' + RUNNER_BUNDLE,
  ], {
    maxBuffer: 16 * 1024 * 1024,
  });
}

async function renderReference(hwpPath, outDir) {
  await execFileAsync(HWP5HTML_BIN, ['--output', outDir, hwpPath], {
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const [xhtml, css] = await Promise.all([
    readFile(path.join(outDir, 'index.xhtml'), 'utf8'),
    readFile(path.join(outDir, 'styles.css'), 'utf8').catch(() => ''),
  ]);
  return `<style>${css}</style>${xhtml}`;
}

async function renderParser(hwpPath, outHtmlPath) {
  await ensureRunnerBundle();
  await execFileAsync('node', [RUNNER_BUNDLE, hwpPath, outHtmlPath], {
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return readFile(outHtmlPath, 'utf8');
}

async function main() {
  const hwpPath = process.argv[2];
  if (!hwpPath) {
    usage();
    process.exit(1);
  }

  const workDir = await mkdtemp(path.join(os.tmpdir(), 'hwp-quality-'));
  const refDir = path.join(workDir, 'ref');
  const parserHtmlPath = path.join(workDir, 'parser.html');

  try {
    const [refHtml, parserHtml] = await Promise.all([
      renderReference(hwpPath, refDir),
      renderParser(hwpPath, parserHtmlPath),
    ]);

    const ref = metricsFromHtml(refHtml);
    const cur = metricsFromHtml(parserHtml);
    const score = overallScore(ref, cur);

    const report = {
      file: hwpPath,
      score,
      reference: ref,
      parser: cur,
      generatedAt: new Date().toISOString(),
    };

    const reportPath = path.resolve('docs', 'quality-report.latest.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(JSON.stringify(report, null, 2));
    console.log(`\nSaved report: ${reportPath}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
