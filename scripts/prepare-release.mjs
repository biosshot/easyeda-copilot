import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { verifyRecovery } from './release-recovery.mjs';

const source = resolve(process.argv[2] ?? '.');
const tag = process.env.RELEASE_TAG;
assert.match(tag ?? '', /^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/);
const pkg = JSON.parse(readFileSync(resolve(source, 'mcp/package.json')));
const manifest = JSON.parse(readFileSync(resolve(source, 'mcp/server.json')));
assert.equal(tag, `v${pkg.version}`);
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.packages[0].version, pkg.version);
assert.equal(manifest.packages[0].identifier, pkg.name);
assert.equal(manifest.name, pkg.mcpName);
if (process.env.ARTIFACT_RUN_ID) {
  assert.match(process.env.ARTIFACT_RUN_ID, /^\d+$/);
  const repository = process.env.GITHUB_REPOSITORY;
  const api = path => JSON.parse(execFileSync('gh', ['api', `repos/${repository}/${path}`], { encoding: 'utf8' }));
  const id = process.env.ARTIFACT_RUN_ID;
  const run = api(`actions/runs/${id}`);
  const jobs = api(`actions/runs/${id}/jobs?per_page=100`);
  assert.ok(jobs.total_count <= 100, 'Unexpectedly large workflow: review job pagination before recovery');
  const sha = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  verifyRecovery(run, jobs.jobs, { repository, tag, sha });
  console.log(`Verified all eight integration gates and tag commit for artifact run ${id}.`);
}
const changelog = readFileSync(resolve(source, 'CHANGELOG.md'), 'utf8');
const section = changelog.split(/^## /m).slice(1).find(section => section.startsWith(`${pkg.version} - `));
assert.ok(section, 'Missing release changelog');
mkdirSync('.artifacts', { recursive: true });
writeFileSync('.artifacts/release-notes.md', `## ${section.trim()}\n`);
