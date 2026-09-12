import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Accept an installed docs directory to detect links that only work in a checkout.
const root = resolve(process.argv[2] || fileURLToPath(new URL('../docs', import.meta.url)));
let links = 0;
const errors = [];
for (const name of readdirSync(root, { recursive: true }).filter(name => name.endsWith('.md'))) {
  const file = resolve(root, name);
  const text = readFileSync(file, 'utf8');
  if (name.split(sep).at(-1) === 'SKILL.md') {
    assert.match(text, /^---\r?\n[\s\S]*?\r?\n---/, `Missing skill metadata: ${name}`);
    assert.match(text, /^name: .+/m, `Missing skill name: ${name}`);
    assert.match(text, /^description: .+/m, `Missing skill description: ${name}`);
  }
  const prose = text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
  const targets = [...prose.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(m => m[1]);
  // Stage routing uses inline-code paths as well as Markdown links.
  if (name === 'SKILL.md') {
    const routes = prose.split('\n').filter(line => line.startsWith('|')).join('\n');
    targets.push(...[...routes.matchAll(/`([^`\s]+\.(?:md|ts))`/g)].map(m => m[1]));
  }
  for (const target of targets) {
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
    const local = decodeURIComponent(target.split('#')[0]);
    const full = resolve(dirname(file), local);
    if (relative(root, full).startsWith('..') || !existsSync(full)) errors.push(`${name}: ${target}`);
    links++;
  }
}
assert.equal(errors.length, 0, `Unavailable packaged documentation links:\n${errors.join('\n')}`);
console.log(`Documentation: ${links} local links resolve inside the distributed docs.`);
