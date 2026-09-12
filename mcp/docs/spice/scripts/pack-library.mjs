import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { createGzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { args, inside, output, fail } from './common.mjs';

async function main() {
  const o = args();
  if (o.help) return output({ usage: 'node pack-library.mjs <exported spice-lib> --out <artifact directory> [--version 2026.09.1] [--url release-asset-url]' });
  if (!o._[0] || !o.out) throw new Error('Supply exported spice-lib directory and --out');
  const source = resolve(o._[0]), out = resolve(o.out), version = o.version || '2026.09.1';
  if (!/^[\w.-]+$/.test(version)) throw new Error('Invalid version');
  await mkdir(out, { recursive: true });
  const rows = (await readFile(join(source, 'ALL-INDEX.txt'), 'utf8')).trim().split(/\r?\n/);
  const columns = rows.shift().split('\t');
  const byPath = new Map();
  for (const line of rows) {
    const values = line.split('\t'), r = Object.fromEntries(columns.map((key, i) => [key, values[i] || '']));
    if (!r.file || byPath.has(r.file)) continue;
    const aliases = [r.components, r.original_identifiers].flatMap(s => s.split(/\s*\|\s*|\s*;\s*/)).filter(Boolean);
    const original = r.file.replace(/^_needs_review\//, '');
    byPath.set(r.file, {
      name: r.name, kind: r.kind, path: r.file, line: Number(r.line),
      source: original.split('/')[0], aliases, description: r.components,
      validation: { status: r.file.startsWith('_needs_review/') ? 'needs_review' : 'compiled',
        engine: 'ngspice', version: '45.2', compatibility: 'ltpsa',
        scope: 'Load and generic instantiation; not electrical accuracy or convergence in the requested circuit.' }
    });
  }
  const models = [...byPath.values()];
  const index = { schemaVersion: 1, version, models };
  const archive = join(out, `spice-library-${version}.jsonl.gz`);
  async function* records() {
    yield JSON.stringify({ path: 'index.json', text: JSON.stringify(index) }) + '\n';
    for (const [i, model] of models.entries()) {
      const text = await readFile(inside(source, model.path), 'utf8');
      yield JSON.stringify({ path: model.path, text }) + '\n';
      if (i % 10000 === 0) console.error(`Packing ${i}/${models.length}`);
    }
    for (const path of ['README.md', 'SUMMARY.txt', 'VALIDATION.txt', 'NGSPICE-CHECKS.txt', 'NORMALIZATION.txt']) {
      yield JSON.stringify({ path, text: await readFile(join(source, path), 'utf8') }) + '\n';
    }
  }
  await pipeline(Readable.from(records()), createGzip({ level: 9 }), createWriteStream(archive));
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  const manifest = { schemaVersion: 1, version, sha256: hash.digest('hex'), format: 'spice-jsonl-gzip-v1' };
  if (o.url) manifest.url = o.url; else manifest.archive = basename(archive);
  await writeFile(join(out, 'library-manifest.json'), JSON.stringify(manifest, null, 2));
  output({ archive, manifest: join(out, 'library-manifest.json'), models: models.length });
}
main().catch(fail);
