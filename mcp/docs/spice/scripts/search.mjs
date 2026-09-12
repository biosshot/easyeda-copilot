import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { args, library, readModel, output, fail } from './common.mjs';

const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next[j + 1] = Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j]));
    row = next;
  }
  return row[b.length];
}
export function rank(models, query, includeReview = false) {
  const q = query.toLowerCase().trim(), n = normalize(q), words = q.split(/\s+/);
  return models.flatMap(model => {
    if (!includeReview && model.validation.status !== 'compiled') return [];
    const names = [model.name, ...(model.aliases || [])].filter(Boolean).map(x => x.toLowerCase());
    let score = 0, match;
    if (names.includes(q)) { score = 100; match = 'exact'; }
    else if (names.some(x => normalize(x) === n)) { score = 90; match = 'normalized'; }
    else if (names.some(x => normalize(x).includes(n))) { score = 75; match = 'substring'; }
    else if (words.every(w => `${names.join(' ')} ${model.description || ''}`.toLowerCase().includes(w))) { score = 60; match = 'description'; }
    else if (n.length >= 5 && n.length <= 40 && names.some(x => distance(n, normalize(x)) <= (n.length >= 9 ? 2 : 1))) { score = 30; match = 'similar-name-not-equivalent'; }
    return score ? [{ ...model, score, match }] : [];
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
}
export async function search(options) {
  const query = options._.join(' ').trim();
  if (!normalize(query) && !options.prepare) throw new Error('Supply a component name or description containing letters or digits');
  const { root, index } = await library(options);
  if (options.prepare) return { status: 'ready', library: root, count: index.models.length };
  const limit = Number(options.limit || 3), textLimit = Number(options['text-limit'] || 30000);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(textLimit) || textLimit < 0) throw new Error('Invalid limit');
  const found = rank(index.models, query, options['include-review']);
  const results = [];
  for (const item of found.slice(0, limit)) {
    const text = await readModel(root, item);
    const { id, path, offset, length, ...metadata } = item;
    results.push({ ...metadata, modelId: id, sourcePath: path, modelText: text.slice(0, textLimit), textTruncated: text.length > textLimit });
  }
  return { status: 'ok', query, libraryVersion: index.version, totalMatches: found.length, results };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options = args();
  if (options.help) output({ usage: 'node search.mjs <MPN or description> [--limit 3] [--include-review] [--library directory] [--manifest file] [--cache directory] [--text-limit 30000] [--prepare] [--no-install]' });
  else search(options).then(output).catch(fail);
}
