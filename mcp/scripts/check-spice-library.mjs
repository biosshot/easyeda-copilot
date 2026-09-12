import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { search } from '../docs/spice/scripts/search.mjs';
import { copyModel } from '../docs/spice/scripts/copy-model.mjs';

// Exercise the public manifest URL and checksum, without a warmed model cache.
const root = await mkdtemp(join(tmpdir(), 'spice public library '));
const options = { cache: root, _: ['1N4148'], limit: '1', 'text-limit': '1000000' };
const online = await search(options);
assert.ok(online.results.length, 'Public model library contains no 1N4148 match');
const offline = await search({ ...options, 'no-install': true });
assert.deepEqual(offline.results, online.results);
const model = online.results[0];
const copied = await copyModel({ ...options, _: [model.modelId], out: join(root, 'selected'), 'no-install': true });
assert.equal(await readFile(copied.path, 'utf8'), model.modelText);
console.log('Public SPICE library: download/checksum, search, offline reuse and model copy passed.');
