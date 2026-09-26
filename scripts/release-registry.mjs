import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export class TemporaryError extends Error {}

// Bound individual requests and the total retry window. Only propagation,
// rate limits, transport errors and server failures are retryable.
export async function retry(label, operation, {
  timeoutMs = 10 * 60_000, now = Date.now, sleep = delay, log = console.log,
} = {}) {
  const deadline = now() + timeoutMs;
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); } catch (error) {
      if (!(error instanceof TemporaryError) || now() >= deadline) throw error;
      const wait = Math.min(5_000 * 2 ** Math.min(attempt, 3), 30_000, deadline - now());
      log(`${label}: ${error.message}; retry in ${Math.ceil(wait / 1000)}s`);
      await sleep(wait);
    }
  }
}

export async function request(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(30_000), headers: { 'Cache-Control': 'no-cache' },
    });
    const body = await response.text();
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new TemporaryError(`HTTP ${response.status} from ${url}`);
    }
    return { status: response.status, ok: response.ok, body };
  } catch (error) {
    if (error instanceof TemporaryError) throw error;
    throw new TemporaryError(`Request failed for ${url}: ${error.message}`);
  }
}

export async function npmVersion(pkg, fetchImpl) {
  const response = await request(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${pkg.version}`, fetchImpl);
  if (response.status === 404) return null;
  assert.ok(response.ok, `npm metadata failed: HTTP ${response.status}: ${response.body}`);
  return JSON.parse(response.body);
}

export function checkNpm(pkg, integrity, published) {
  assert.equal(published.name, pkg.name);
  assert.equal(published.version, pkg.version);
  assert.equal(published.dist?.integrity, integrity,
    `${pkg.name}@${pkg.version} already exists with different contents. Bump its version before releasing.`);
  if (pkg.mcpName) assert.equal(published.mcpName, pkg.mcpName);
}

export async function waitForNpm(pkg, integrity, options = {}) {
  return retry('npm availability', async () => {
    const published = await npmVersion(pkg, options.fetchImpl);
    if (!published) throw new TemporaryError(`${pkg.name}@${pkg.version} is not visible yet`);
    checkNpm(pkg, integrity, published);
    return published;
  }, options);
}

export const archiveIntegrity = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');

export async function registeredServer(manifest, fetchImpl) {
  const url = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(manifest.name)}/versions/${manifest.version}`;
  const response = await request(url, fetchImpl);
  if (response.status === 404) return false;
  assert.ok(response.ok, `MCP Registry lookup failed: HTTP ${response.status}: ${response.body}`);
  const entry = JSON.parse(response.body);
  assert.deepEqual(entry.server, manifest, 'MCP Registry version already exists with different metadata');
  assert.equal(entry._meta?.['io.modelcontextprotocol.registry/official']?.status, 'active',
    'MCP Registry version exists but is not active');
  return true;
}

export function transientPublisherError(output) {
  // HTTP 400 is transient only when the registry's npm edge still sees 404.
  if (/NPM package .+version .+was not found.*status: 404/is.test(output)) return true;
  if (/(?:HTTP|status(?: code)?)[\s:"=]+(?:408|429|5\d\d)\b/i.test(output)) return true;
  return /(?:connection reset|connection refused|i\/o timeout|TLS handshake timeout|context deadline exceeded|temporary failure|no such host|unexpected EOF)/i.test(output);
}

export async function publishRegistry(manifest, runPublisher, options = {}) {
  let accepted = false;
  await retry('MCP Registry publication', async () => {
    if (await registeredServer(manifest, options.fetchImpl)) return;
    if (accepted) throw new TemporaryError('Accepted MCP Registry version is not visible yet');
    try {
      await runPublisher(['login', 'github-oidc']);
      await runPublisher(['publish']);
      accepted = true;
    } catch (error) {
      // A write can commit even if its response is lost. Verify identity first.
      if (await registeredServer(manifest, options.fetchImpl)) return;
      if (/(?:HTTP|status(?: code)?)[\s:"=]+409\b/i.test(error.message)) {
        accepted = true;
        throw new TemporaryError('Registry reports an existing version; waiting to verify its metadata');
      }
      if (error instanceof TemporaryError || transientPublisherError(error.message)) {
        throw new TemporaryError(error.message);
      }
      throw error;
    }
    if (!await registeredServer(manifest, options.fetchImpl)) {
      throw new TemporaryError('Published version is not visible in MCP Registry yet');
    }
  }, options);
}
