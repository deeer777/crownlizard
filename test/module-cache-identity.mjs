import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'));
const readRoot = relativePath => readFile(resolve(root, relativePath.replace(/^\//, '')), 'utf8');
const origin = 'https://crownlizard.test';
const index = await readRoot('index.html');
const bootstrapSpecifier = index.match(/<script\s+type="module"\s+src="([^"]*\/src\/bootstrap\.js\?v=[^"]+)"/)?.[1];
assert.ok(bootstrapSpecifier, 'index.html must expose one versioned bootstrap module');
const bootstrapUrl = new URL(bootstrapSpecifier, new URL('/index.html', origin));
const bootstrapId = `${bootstrapUrl.pathname}${bootstrapUrl.search}`;
const importPattern = /(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;
const pending = [bootstrapId];
const modules = new Set();

while (pending.length) {
  const moduleId = pending.shift();
  if (modules.has(moduleId)) continue;
  modules.add(moduleId);
  const source = await readRoot(new URL(moduleId, origin).pathname);
  for (const match of source.matchAll(importPattern)) {
    const imported = new URL(match[1], new URL(moduleId, origin));
    if (imported.origin === origin && imported.pathname.endsWith('.js')) pending.push(`${imported.pathname}${imported.search}`);
  }
}

const identities = new Map();
for (const moduleId of modules) {
  const { pathname } = new URL(moduleId, origin);
  assert.equal(identities.has(pathname), false, `${pathname} is imported through more than one cache identity`);
  identities.set(pathname, moduleId);
}

const worker = await readRoot('sw.js');
const appShellBody = worker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] || '';
const appShell = new Set(Array.from(appShellBody.matchAll(/['"]([^'"]+)['"]/g), match => match[1]));
for (const moduleId of modules) assert.equal(appShell.has(moduleId), true, `${moduleId} must be available in the offline app shell`);

const cachedModules = [...appShell].filter(entry => entry.startsWith('/src/') && entry.includes('.js'));
for (const moduleId of cachedModules) assert.equal(modules.has(moduleId), true, `${moduleId} is a stale or mismatched module cache identity`);

console.log(`Module cache identities verified across ${modules.size} reachable modules.`);
