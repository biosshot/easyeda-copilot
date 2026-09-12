import { mkdir, readdir, writeFile, rename, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cacheRoot, exists, json, run, locked, download } from './common.mjs';

async function probe(path) {
  const r = await run(path, ['--version'], { timeout: 10000 });
  const version = `${r.stdout}\n${r.stderr}`.match(/ngspice[-\s]+(\d+(?:\.\d+)?)/i)?.[1];
  if (r.code !== 0 || !version) throw new Error(`Not a working ngspice executable: ${path}`);
  return { path, version };
}
async function findExecutable(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && /^ngspice_con\.exe$/i.test(entry.name)) return join(root, entry.name);
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) { const found = await findExecutable(join(root, entry.name)); if (found) return found; }
  }
  return null;
}
export async function ngspice(options) {
  const explicit = options.ngspice || process.env.SPICE_NGSPICE;
  if (explicit) return probe(resolve(explicit));
  for (const command of process.platform === 'win32' ? ['ngspice_con.exe', 'ngspice.exe'] : ['ngspice']) {
    try { return await probe(command); } catch { /* check managed runtime */ }
  }
  const parent = join(cacheRoot(options), 'ngspice');
  const root = join(parent, '47-win32-x64');
  const cached = async () => {
    try { const info = await json(join(root, 'runtime.json')); return await probe(join(root, info.executable)); } catch { return null; }
  };
  if (process.platform === 'win32' && process.arch === 'x64') {
    const found = await cached(); if (found) return found;
    if (!options['no-install']) {
      try { await locked(parent, '47-win32-x64', async () => {
        if (await cached()) return;
        const stage = `${root}.partial-${randomUUID()}`, archive = `${stage}.7z`;
        await mkdir(stage, { recursive: true });
        try {
          console.error('Downloading official ngspice 47 Windows runtime...');
          const url = 'https://sourceforge.net/projects/ngspice/files/ng-spice-rework/47/ngspice-47_64.7z/download';
          const sha256 = await download(url, archive);
          const listing = await run('tar', ['-tf', archive]).catch(error => ({ code: -1, stderr: error.message }));
          let extractor = null, names;
          if (listing.code === 0) names = listing.stdout.trim().split(/\r?\n/);
          else {
            // Windows libarchive cannot read some official 7z entries. Prefer 7-Zip,
            // otherwise prepare its standalone official extractor in the same cache.
            for (const candidate of ['7z', join(process.env.ProgramFiles || 'C:/Program Files', '7-Zip/7z.exe'), join(parent, '7zr.exe')]) {
              try { if ((await run(candidate, [], { timeout: 10000 })).code === 0) { extractor = candidate; break; } } catch { /* next */ }
            }
            if (!extractor) {
              extractor = join(parent, '7zr.exe');
              const pending = `${extractor}.${randomUUID()}.partial`;
              try {
                await download('https://www.7-zip.org/a/7zr.exe', pending);
                if ((await readFile(pending)).subarray(0, 2).toString() !== 'MZ') throw new Error('Invalid 7-Zip extractor download');
                await rename(pending, extractor);
              } finally { await rm(pending, { force: true }); }
            }
            const details = await run(extractor, ['l', '-slt', '-ba', archive]);
            if (details.code !== 0 || /^(?:Symbolic Link|Hard Link) =/m.test(details.stdout)) throw new Error(`Cannot inspect ngspice archive: ${details.stderr}`);
            names = [...details.stdout.matchAll(/^Path = (.+)\r?$/gm)].map(m => m[1].trim());
            if (!names.length) throw new Error('ngspice archive is empty');
          }
          for (const name of names) {
            if (/^[\\/]|^[A-Za-z]:/.test(name) || name.split(/[\\/]/).includes('..')) throw new Error('Unsafe ngspice archive path');
          }
          if (!extractor) {
            const types = await run('tar', ['-tvf', archive]);
            if (types.code !== 0 || types.stdout.trim().split(/\r?\n/).some(line => !/^[d-]/.test(line))) throw new Error('ngspice archive contains unsupported entry types');
          }
          const extraction = extractor ? await run(extractor, ['x', '-y', `-o${stage}`, archive]) : await run('tar', ['-xf', archive, '-C', stage]);
          if (extraction.code !== 0) throw new Error(extraction.stderr);
          const executable = await findExecutable(stage);
          if (!executable) throw new Error('Console executable is missing from ngspice archive');
          const info = await probe(executable);
          if (info.version !== '47') throw new Error(`Unexpected ngspice version: ${info.version}`);
          const fixture = join(stage, 'runtime-check.cir');
          await writeFile(fixture, 'Runtime check\nV1 out 0 1\nR1 out 0 1k\n.control\nop\nprint v(out)\nquit\n.endc\n.end\n');
          const check = await run(executable, ['-n', '-b', fixture], { cwd: stage });
          if (check.code !== 0 || !/v\(out\)\s*=\s*1\.0+/i.test(check.stdout)) throw new Error('ngspice runtime smoke test failed');
          await writeFile(join(stage, 'runtime.json'), JSON.stringify({ executable: executable.slice(stage.length + 1), version: info.version, url, sha256 }));
          if (await exists(root)) throw new Error(`Invalid managed runtime already exists: ${root}. Remove it and retry.`);
          await rename(stage, root);
        } finally { await rm(stage, { recursive: true, force: true }); await rm(archive, { force: true }); }
      }); } catch (error) {
        throw new Error(`Automatic ngspice preparation failed: ${error.message}. Install ngspice using references/installation.md, then retry with --ngspice <absolute executable path>.`);
      }
      return await cached();
    }
  }
  throw new Error('ngspice_not_found: install ngspice for this platform (references/installation.md), then rerun with --ngspice <absolute executable path>.');
}
