import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { args, library, readModel, output, fail } from './common.mjs';

export async function copyModel(options) {
  if (options._.length !== 1 || !options.out) throw new Error('Supply one exact modelId from search and --out <models directory>');
  const { root, index } = await library(options);
  const model = index.models.find(m => m.id === options._[0]);
  if (!model) throw new Error(`Unknown modelId: ${options._[0]}. Use search.mjs to select an exact ID.`);
  const text = await readModel(root, model);
  const directory = resolve(options.out);
  if (/["\r\n$]/.test(directory)) throw new Error('Output path cannot contain quotes, dollar signs or line breaks');
  // Source path hash avoids collisions between same-named models in different libraries.
  const suffix = createHash('sha256').update(model.id).digest('hex').slice(0, 12);
  const filename = `${basename(model.path).replace(/\.lib$/i, '').replace(/[^a-z0-9._-]/gi, '_').slice(0, 120)}--${suffix}.lib`;
  const path = join(directory, filename);
  await mkdir(directory, { recursive: true });
  let reused = false;
  try { await writeFile(path, text, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (await readFile(path, 'utf8') !== text) throw new Error(`Existing model file differs; refusing to overwrite ${path}`);
    reused = true;
  }
  return { status: 'ok', modelId: model.id, name: model.name, kind: model.kind, validation: model.validation,
    libraryVersion: index.version, path, include: `.include "${path.replaceAll('\\', '/')}"`, reused,
    sha256: createHash('sha256').update(text).digest('hex') };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options = args();
  if (options.help) output({ usage: 'node copy-model.mjs <modelId> --out <directory> [--library directory] [--manifest file] [--cache directory] [--no-install]' });
  else copyModel(options).then(output).catch(fail);
}
