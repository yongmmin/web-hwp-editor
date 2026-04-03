import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.HWP_BRIDGE_PORT || 3210);
const HWP5HTML_BIN = process.env.HWP5HTML_BIN || '/Users/iyongmin/Library/Python/3.10/bin/hwp5html';
const HWP5ODT_BIN = process.env.HWP5ODT_BIN || '/Users/iyongmin/Library/Python/3.10/bin/hwp5odt';
const MAX_BODY_BYTES = 80 * 1024 * 1024;
const TTL_MS = 20 * 60 * 1000;

const renderStore = new Map();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  setCors(res);
  res.end(body);
}

function decodeBase64ToBuffer(base64) {
  return Buffer.from(base64, 'base64');
}

function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1] : html;
}

async function safeRead(filePath, fallback = '') {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

function rewriteAssetUrls(text, renderId, bridgeOrigin) {
  const assetPrefix = `${bridgeOrigin}/asset/${renderId}/`;
  return text
    .replace(
      /\b(href|src)\s*=\s*(["'])(?:\.\/)?styles\.css\2/gi,
      `$1=$2${assetPrefix}styles.css$2`,
    )
    .replace(
      /\b(href|src)\s*=\s*(["'])(?:\.\/)?bindata\//gi,
      `$1=$2${assetPrefix}bindata/`,
    )
    .replace(
      /url\((["']?)(?:\.\/)?bindata\//gi,
      `url($1${assetPrefix}bindata/`,
    );
}

function composeHtml(indexXhtml, css, renderId, bridgeOrigin) {
  const rewrittenXhtml = rewriteAssetUrls(indexXhtml, renderId, bridgeOrigin);
  if (/<html[\s>]/i.test(rewrittenXhtml)) {
    return rewrittenXhtml;
  }

  const body = rewriteAssetUrls(extractBody(indexXhtml), renderId, bridgeOrigin);
  const scopedCss = rewriteAssetUrls(css, renderId, bridgeOrigin);
  return `<!doctype html><html><head><meta charset="utf-8" /><style>${scopedCss}</style></head><body>${body}</body></html>`;
}

const IMAGE_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
};

async function convertHwpToOdt(fileName, bufferBase64) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'hwp-odt-'));
  const inputPath = path.join(tmpDir, sanitizeFileName(fileName || 'upload.hwp'));
  const outputPath = path.join(tmpDir, 'out.odt');

  await writeFile(inputPath, decodeBase64ToBuffer(bufferBase64));

  // hwp5odt may exit non-zero for non-fatal XML validation warnings.
  // Attempt the conversion and check if the output file was produced regardless.
  try {
    await execFileAsync(HWP5ODT_BIN, ['--output', outputPath, inputPath], {
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (convErr) {
    // If the output file was not created, re-throw so caller gets the real error.
    try { await readFile(outputPath); } catch {
      throw convErr;
    }
    // Output exists despite non-zero exit — proceed (e.g. RELAX NG validation warnings).
  }

  const [contentXmlResult, stylesXmlResult] = await Promise.all([
    execFileAsync('unzip', ['-p', outputPath, 'content.xml'], { maxBuffer: 32 * 1024 * 1024 }),
    execFileAsync('unzip', ['-p', outputPath, 'styles.xml'], { maxBuffer: 16 * 1024 * 1024 }),
  ]);

  // Extract bindata images
  const images = {};
  try {
    await execFileAsync('unzip', ['-q', '-o', outputPath, 'bindata/*', '-d', tmpDir], {
      maxBuffer: 64 * 1024 * 1024,
    });
    const bindataDir = path.join(tmpDir, 'bindata');
    const files = await readdir(bindataDir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const mime = IMAGE_MIME[ext];
      if (!mime) continue;
      const data = await readFile(path.join(bindataDir, file));
      if (data.length > 12_000_000) continue;
      images[`bindata/${file}`] = `data:${mime};base64,${data.toString('base64')}`;
    }
  } catch { /* no bindata or extraction failed — skip */ }

  rm(tmpDir, { recursive: true, force: true }).catch(() => {});

  return {
    contentXml: contentXmlResult.stdout,
    stylesXml: stylesXmlResult.stdout,
    images,
  };
}

async function convertHwpToHtml(fileName, bufferBase64) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'hwp-bridge-'));
  const inputPath = path.join(tmpDir, sanitizeFileName(fileName || 'upload.hwp'));
  const outputDir = path.join(tmpDir, 'html');

  await writeFile(inputPath, decodeBase64ToBuffer(bufferBase64));

  await execFileAsync(HWP5HTML_BIN, ['--output', outputDir, inputPath], {
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });

  const [indexXhtml, css] = await Promise.all([
    safeRead(path.join(outputDir, 'index.xhtml')),
    safeRead(path.join(outputDir, 'styles.css')),
  ]);

  if (!indexXhtml.trim()) {
    throw new Error('hwp5html output is empty');
  }

  const renderId = crypto.randomBytes(8).toString('hex');
  renderStore.set(renderId, {
    outputDir,
    createdAt: Date.now(),
    rootDir: tmpDir,
  });

  const bridgeOrigin = `http://127.0.0.1:${PORT}`;
  const html = composeHtml(indexXhtml, css, renderId, bridgeOrigin);
  return { renderId, html };
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^\w\- .()\u3131-\uD79D]/g, '_');
}

function cleanupExpiredRenders() {
  const now = Date.now();
  for (const [id, entry] of renderStore.entries()) {
    if (now - entry.createdAt < TTL_MS) continue;
    renderStore.delete(id);
    rm(entry.rootDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error('payload too large');
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text);
}

const server = createServer(async (req, res) => {
  cleanupExpiredRenders();

  if (req.method === 'OPTIONS') {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/extract-hwp') {
    try {
      const body = await readJsonBody(req);
      const fileName = String(body?.fileName || 'upload.hwp');
      const bufferBase64 = String(body?.bufferBase64 || '');

      if (!bufferBase64) {
        json(res, 400, { error: 'bufferBase64 is required' });
        return;
      }

      const result = await convertHwpToOdt(fileName, bufferBase64);
      json(res, 200, result);
      return;
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : 'odt conversion failed' });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/render-hwp') {
    try {
      const body = await readJsonBody(req);
      const fileName = String(body?.fileName || 'upload.hwp');
      const bufferBase64 = String(body?.bufferBase64 || '');

      if (!bufferBase64) {
        json(res, 400, { error: 'bufferBase64 is required' });
        return;
      }

      const result = await convertHwpToHtml(fileName, bufferBase64);
      json(res, 200, result);
      return;
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : 'render failed' });
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/asset/')) {
    const parts = req.url.split('/');
    const renderId = parts[2];
    const relativePath = parts.slice(3).join('/');
    const entry = renderStore.get(renderId);
    if (!entry || !relativePath) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const target = path.normalize(path.join(entry.outputDir, relativePath));
    if (!target.startsWith(entry.outputDir)) {
      res.statusCode = 400;
      res.end('Bad request');
      return;
    }

    try {
      const file = await readFile(target);
      const ext = path.extname(target).toLowerCase();
      const contentType = guessContentType(ext);
      if (contentType) res.setHeader('Content-Type', contentType);
      setCors(res);
      res.statusCode = 200;
      res.end(file);
      return;
    } catch {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { ok: true, port: PORT, hwp5html: HWP5HTML_BIN });
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const filePath = fileURLToPath(import.meta.url);
  const dir = path.dirname(filePath);
  console.log(`[hwp-bridge] listening on http://127.0.0.1:${PORT}`);
  console.log(`[hwp-bridge] script: ${path.join(dir, 'hwp-render-bridge.mjs')}`);
  console.log(`[hwp-bridge] converter: ${HWP5HTML_BIN}`);
});

function guessContentType(ext) {
  const map = {
    '.css': 'text/css; charset=utf-8',
    '.xhtml': 'application/xhtml+xml; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.wmf': 'image/wmf',
    '.emf': 'image/emf',
    '.svg': 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}
