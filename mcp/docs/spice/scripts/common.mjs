import { mkdir, readFile, writeFile, rename, rm, stat, open } from 'node:fs/promises';
import { createReadStream, createWriteStream, realpathSync } from 'node:fs';
import { get } from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';

export const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function isMain(url) {
  return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url));
}
export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { out._.push(argv[i]); continue; }
    const key = argv[i].slice(2);
    if (['help', 'include-review', 'no-install', 'no-plot', 'prepare'].includes(key)) out[key] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for --${key}`);
      out[key] = argv[++i];
    }
  }
  return out;
}
export const cacheRoot = options => resolve(options.cache || process.env.SPICE_CACHE_DIR || join(tmpdir(), 'easyeda-copilot-mcp', 'spice'));
export async function exists(path) { try { await stat(path); return true; } catch { return false; } }
export const json = async path => JSON.parse(await readFile(path, 'utf8'));
export const output = value => console.log(JSON.stringify(value, null, 2));
export function fail(error) { output({ status: 'error', message: error.message }); process.exitCode = 1; }
export function inside(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') || relative.startsWith('/') || relative.split('/').some(x => x === '..' || !x)) throw new Error(`Unsafe archive path: ${relative}`);
  const target = resolve(root, relative);
  if (!target.startsWith(resolve(root) + sep)) throw new Error(`Path escapes root: ${relative}`);
  return target;
}
export async function locked(root, key, fn) {
  await mkdir(root, { recursive: true });
  const lock = join(root, `${key}.lock`);
  const deadline = Date.now() + 300_000;
  while (true) {
    try { await mkdir(lock); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() > deadline) throw new Error(`Installation lock is busy: ${lock}. If its owner exited, remove this lock and retry.`);
      await new Promise(r => setTimeout(r, 300));
    }
  }
  try { return await fn(); } finally { await rm(lock, { recursive: true, force: true }); }
}
export async function download(url, target, expectedHash) {
  if (!String(url).startsWith('https://')) throw new Error('Downloads require HTTPS');
  const hash = createHash('sha256');
  let bytes = 0;
  const signal = AbortSignal.timeout(180_000);
  const request = (address, redirects = 0) => new Promise((accept, reject) => {
    if (new URL(address).protocol !== 'https:') return reject(new Error('Downloads require HTTPS'));
    get(address, { signal }, response => {
      response.on('error', reject);
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (!response.headers.location || redirects >= 5) return reject(new Error('Invalid or excessive download redirects'));
        try { accept(request(new URL(response.headers.location, address), redirects + 1)); }
        catch (error) { reject(error); }
      } else if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed: HTTP ${response.statusCode} ${address}`));
      } else accept(response);
    }).on('error', reject);
  });
  // Use Node's HTTPS stream directly: some Node 24 fetch/Undici versions crash
  // while consuming the redirected SourceForge archive response.
  const response = await request(url);
  await pipeline(response, async function* (source) {
    for await (const chunk of source) {
      bytes += chunk.length;
      if (bytes > 1024 ** 3) throw new Error('Download exceeds 1 GiB');
      hash.update(chunk); yield chunk;
    }
  }, createWriteStream(target, { flags: 'wx' }));
  const digest = hash.digest('hex');
  if (expectedHash && digest !== expectedHash.toLowerCase()) throw new Error('Archive SHA-256 mismatch');
  return digest;
}
// Streaming text archive: one {path,text} JSON record per line, compressed with gzip.
// Keep a single JSONL and a byte-offset index; materialize .lib files only on request.
export async function unpackModels(archive, target) {
  await mkdir(target, { recursive: true });
  const compressed = createReadStream(archive), source = createGunzip();
  compressed.on('error', error => source.destroy(error));
  compressed.pipe(source);
  let total = 0, count = 0;
  const seen = new Set(), records = new Map();
  let index, offset = 0;
  source.on('data', chunk => { total += chunk.length; if (total > 2 * 1024 ** 3) source.destroy(new Error('Expanded archive exceeds 2 GiB')); });
  const lines = createInterface({ input: source, crlfDelay: Infinity });
  async function* entries() {
    for await (const line of lines) {
      const record = JSON.parse(line);
      if (typeof record.text !== 'string' || ++count > 150_000) throw new Error('Invalid model archive');
      const path = inside(target, record.path);
      const key = path.toLowerCase();
      if (seen.has(key)) throw new Error(`Duplicate archive path: ${record.path}`);
      seen.add(key);
      const bytes = Buffer.from(JSON.stringify(record) + '\n', 'utf8');
      records.set(record.path, { offset, length: bytes.length });
      offset += bytes.length;
      if (record.path === 'index.json') index = JSON.parse(record.text);
      yield bytes;
    }
  }
  try {
    await pipeline(Readable.from(entries()), createWriteStream(join(target, 'library.jsonl'), { flags: 'wx', highWaterMark: 1024 * 1024 }));
  } finally { lines.close(); source.destroy(); compressed.destroy(); }
  if (index?.schemaVersion !== 1 || !Array.isArray(index.models)) throw new Error('Unsupported model index');
  const ids = new Set();
  for (const model of index.models) {
    inside(target, model.path);
    const entry = records.get(model.path);
    if (!entry) throw new Error(`Missing model: ${model.path}`);
    if (ids.has(model.path)) throw new Error(`Duplicate model ID: ${model.path}`);
    ids.add(model.path);
    Object.assign(model, { id: model.path, ...entry });
  }
  Object.assign(index, { storage: 'jsonl-v1', dataBytes: offset });
  await writeFile(join(target, 'index.json'), JSON.stringify(index), { flag: 'wx' });
  return index;
}
export async function readModel(root, model) {
  if (!Number.isSafeInteger(model.offset) || model.offset < 0 || !Number.isSafeInteger(model.length) || model.length < 1 || model.length > 256 * 1024 ** 2) throw new Error('Invalid model byte range');
  const handle = await open(join(root, 'library.jsonl'), 'r');
  try {
    const size = (await handle.stat()).size;
    if (model.offset + model.length > size) throw new Error('Model byte range exceeds library size');
    const bytes = Buffer.alloc(model.length);
    let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await handle.read(bytes, total, bytes.length - total, model.offset + total);
      if (!bytesRead) throw new Error('Truncated model record');
      total += bytesRead;
    }
    const record = JSON.parse(bytes.toString('utf8'));
    if (record.path !== model.path || typeof record.text !== 'string') throw new Error('Model index does not match JSONL record');
    return record.text;
  } finally { await handle.close(); }
}
export async function library(options) {
  const explicit = options.library || process.env.SPICE_LIBRARY_DIR;
  if (explicit) {
    const root = resolve(explicit);
    const index = await json(join(root, 'index.json'));
    if (index.schemaVersion !== 1 || index.storage !== 'jsonl-v1') throw new Error('Expected JSONL cache: index.json and library.jsonl. Prepare it with search --manifest instead of using the old per-file cache.');
    return { root, index };
  }
  const manifestPath = resolve(options.manifest || process.env.SPICE_LIBRARY_MANIFEST || join(skillRoot, 'library-manifest.json'));
  const manifest = await json(manifestPath);
  if (!/^[\w.-]+$/.test(manifest.version)) throw new Error('Invalid library version');
  const root = join(cacheRoot(options), 'library', `${manifest.version}-jsonl-v1`);
  const ready = async () => {
    try {
      const index = await json(join(root, 'index.json'));
      return index.storage === 'jsonl-v1' && index.archiveSha256 === manifest.sha256 && index.dataBytes === (await stat(join(root, 'library.jsonl'))).size;
    } catch { return false; }
  };
  if (!await ready()) await locked(join(cacheRoot(options), 'library'), `${manifest.version}-jsonl-v1`, async () => {
    if (await ready()) return;
    if (options['no-install']) throw new Error('Model library is not cached; rerun without --no-install or supply --library');
    if (!manifest.url && !manifest.archive) throw new Error('Library release has not been published. Supply --manifest <generated manifest.json> or --library <directory with index.json>.');
    if (!/^[a-f0-9]{64}$/i.test(manifest.sha256 || '')) throw new Error('Library manifest must contain SHA-256');
    const stage = `${root}.partial-${randomUUID()}`;
    const archive = `${stage}.gz`;
    await mkdir(stage, { recursive: true });
    try {
      console.error(`Preparing SPICE model library ${manifest.version}...`);
      let source = archive;
      if (manifest.archive) {
        source = resolve(dirname(manifestPath), manifest.archive);
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(source)) hash.update(chunk);
        if (hash.digest('hex') !== manifest.sha256) throw new Error('Archive SHA-256 mismatch');
      } else await download(manifest.url, archive, manifest.sha256);
      const index = await unpackModels(source, stage);
      if (index.version !== manifest.version) throw new Error('Archive version does not match manifest');
      index.archiveSha256 = manifest.sha256;
      await writeFile(join(stage, 'index.json'), JSON.stringify(index));
      if (await exists(root)) throw new Error(`Library cache exists but has a different manifest: ${root}. Use a new version or remove this cache directory.`);
      await rename(stage, root);
    } finally { await rm(stage, { recursive: true, force: true }); await rm(archive, { force: true }); }
  });
  return { root, index: await json(join(root, 'index.json')) };
}
export function run(executable, argv, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, argv, { cwd: options.cwd, env: options.env || process.env, windowsHide: true, shell: false });
    let stdout = '', stderr = '', timedOut = false;
    const log = options.log ? createWriteStream(options.log) : null;
    child.stdout.on('data', b => { stdout = (stdout + b).slice(-2_000_000); log?.write(b); });
    child.stderr.on('data', b => { stderr = (stderr + b).slice(-2_000_000); log?.write(b); });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, options.timeout || 60_000);
    child.on('error', e => { clearTimeout(timer); log?.end(); reject(e); });
    child.on('close', code => { clearTimeout(timer); log?.end(); resolveRun({ code, stdout, stderr, timedOut }); });
  });
}
