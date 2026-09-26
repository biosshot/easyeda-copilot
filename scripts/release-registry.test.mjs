import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TemporaryError, archiveIntegrity, publishRegistry, retry, transientPublisherError, waitForNpm,
} from './release-registry.mjs';
import { verifyRecovery } from './release-recovery.mjs';

const pkg = { name: 'easyeda-copilot-mcp', version: '1.3.0', mcpName: 'io.github.biosshot/easyeda-copilot' };
const integrity = archiveIntegrity(Buffer.from('original tested archive'));
const metadata = { ...pkg, dist: { integrity } };
const manifest = { name: pkg.mcpName, version: pkg.version, packages: [{ identifier: pkg.name, version: pkg.version }] };
const entry = { server: manifest, _meta: { 'io.modelcontextprotocol.registry/official': { status: 'active' } } };
const propagationFailure = 'HTTP 400: {"title":"Bad Request","status":400,"detail":"Failed to publish server","errors":[{"message":"registry validation failed for package 0 (easyeda-copilot-mcp): NPM package \'easyeda-copilot-mcp\' exists, but version \'1.3.0\' was not found (status: 404). A newly published release can take a moment to appear on the registry. Wait and retry"}]}';
const response = (status, body = {}) => new Response(JSON.stringify(body), { status });
function options(fetchImpl) {
  let clock = 0;
  const waits = [];
  return { fetchImpl, now: () => clock, sleep: async ms => { waits.push(ms); clock += ms; },
    log() {}, timeoutMs: 20_000, waits };
}

test('npm propagation: 404, 429, 503, then the exact tested package', async () => {
  const statuses = [404, 429, 503, 200];
  const opts = options(async () => response(statuses.shift(), metadata));
  assert.deepEqual(await waitForNpm(pkg, integrity, opts), metadata);
  assert.equal(opts.waits.length, 3);
});

test('npm transport failure is retried, permanent HTTP errors are not', async () => {
  let calls = 0;
  await waitForNpm(pkg, integrity, options(async () => {
    if (++calls === 1) throw new TypeError('fetch failed');
    return response(200, metadata);
  }));
  assert.equal(calls, 2);
  const opts = options(async () => response(403));
  await assert.rejects(waitForNpm(pkg, integrity, opts), /HTTP 403/);
  assert.equal(opts.waits.length, 0);
});

test('npm checksum, version and MCP ownership mismatches fail immediately', async () => {
  for (const invalid of [{ ...metadata, dist: { integrity: 'sha512-wrong' } },
    { ...metadata, version: '1.2.0' }, { ...metadata, mcpName: 'another/server' }]) {
    const opts = options(async () => response(200, invalid));
    await assert.rejects(waitForNpm(pkg, integrity, opts));
    assert.equal(opts.waits.length, 0);
  }
});

test('retry budget expires rather than hiding a prolonged outage', async () => {
  const opts = options();
  await assert.rejects(retry('test', async () => { throw new TemporaryError('offline'); }, opts), /offline/);
  assert.equal(opts.waits.reduce((sum, ms) => sum + ms, 0), opts.timeoutMs);
});

test('the actual 1.3.0 propagation failure is retryable, arbitrary 400/401/403 are not', () => {
  for (const text of [propagationFailure, 'HTTP 502', '{"status":429}', 'context deadline exceeded']) {
    assert.equal(transientPublisherError(text), true, text);
  }
  for (const text of ['HTTP 400 invalid schema', 'HTTP 401 invalid audience', 'HTTP 403 forbidden',
    'HTTP 409 version already exists', 'HTTP 400 NPM package is missing mcpName']) {
    assert.equal(transientPublisherError(text), false, text);
  }
});

test('MCP npm edge propagation is retried even after npm is available to the runner', async () => {
  let published = false;
  let attempts = 0;
  const opts = options(async () => published ? response(200, entry) : response(404));
  await publishRegistry(manifest, async ([command]) => {
    if (command === 'publish') {
      if (++attempts === 1) throw new Error(propagationFailure);
      published = true;
    }
  }, opts);
  assert.equal(attempts, 2);
  assert.equal(opts.waits.length, 1);
});

test('already published identical active server skips login and publication', async () => {
  await publishRegistry(manifest, () => assert.fail('must not republish'), options(async () => response(200, entry)));
});

test('lost success response is reconciled without a second write', async () => {
  let published = false;
  let writes = 0;
  await publishRegistry(manifest, async ([command]) => {
    if (command === 'publish') {
      writes++;
      published = true;
      throw new Error('connection reset');
    }
  }, options(async () => published ? response(200, entry) : response(404)));
  assert.equal(writes, 1);
});

test('temporary OIDC and registry lookup failures recover', async () => {
  let reads = 0;
  let logins = 0;
  let published = false;
  await publishRegistry(manifest, async ([command]) => {
    if (command === 'login' && ++logins === 1) throw new Error('HTTP 503');
    if (command === 'publish') published = true;
  }, options(async () => {
    if (++reads === 1) return response(502);
    return published ? response(200, entry) : response(404);
  }));
  assert.equal(logins, 2);
});

test('accepted writes and HTTP 409 are polled without issuing more writes', async () => {
  for (const conflict of [false, true]) {
    let reads = 0;
    let writes = 0;
    await publishRegistry(manifest, async ([command]) => {
      if (command === 'publish') {
        writes++;
        if (conflict) throw new Error('server returned status 409: version already exists');
      }
    }, options(async () => ++reads > 3 ? response(200, entry) : response(404)));
    assert.equal(writes, 1);
  }
});

test('schema/auth failures stop without repeated publication', async () => {
  for (const failure of ['HTTP 400 invalid schema', 'HTTP 403 forbidden']) {
    const opts = options(async () => response(404));
    await assert.rejects(publishRegistry(manifest, async () => { throw new Error(failure); }, opts), new RegExp(failure));
    assert.equal(opts.waits.length, 0);
  }
});

test('existing conflicting or inactive entries never count as success', async () => {
  for (const invalid of [{ ...entry, server: { ...manifest, description: 'different' } },
    { ...entry, _meta: { 'io.modelcontextprotocol.registry/official': { status: 'deleted' } } }]) {
    const opts = options(async () => response(200, invalid));
    await assert.rejects(publishRegistry(manifest, () => assert.fail('must not publish'), opts));
    assert.equal(opts.waits.length, 0);
  }
});

const context = { repository: 'biosshot/easyeda-copilot', tag: 'v1.3.0', sha: 'original-sha' };
const run = { repository: { full_name: context.repository }, path: '.github/workflows/build.yml',
  event: 'push', head_branch: context.tag, head_sha: context.sha, status: 'completed' };
const jobs = ['ubuntu-22.04', 'windows-latest', 'macos-15-intel', 'macos-15'].flatMap(os =>
  [20, 24].map(node => ({ name: `integration / test (${os}, ${node})`, conclusion: 'success' })));

test('recovery accepts the original failed publication when all eight gates passed', () => {
  verifyRecovery({ ...run, conclusion: 'failure' }, [...jobs, { name: 'publish', conclusion: 'failure' }], context);
});

test('recovery rejects wrong commit, event, workflow, repository or missing/failed gate', () => {
  for (const invalid of [{ ...run, head_sha: 'other' }, { ...run, event: 'pull_request' },
    { ...run, path: 'other.yml' }, { ...run, repository: { full_name: 'someone/else' } },
    { ...run, head_branch: 'main' }, { ...run, status: 'in_progress' }]) {
    assert.throws(() => verifyRecovery(invalid, jobs, context));
  }
  assert.throws(() => verifyRecovery(run, jobs.slice(1), context));
  assert.throws(() => verifyRecovery(run, [{ ...jobs[0], conclusion: 'failure' }, ...jobs.slice(1)], context));
});
