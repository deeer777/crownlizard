import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const requirements = JSON.parse(await readFile(new URL('../cloudflare-pages.required.json', import.meta.url), 'utf8'));
const required = [...(requirements.secrets || [])];
assert.equal(requirements.project, wrangler.name, 'Pages requirement manifest targets the wrong Cloudflare project');
assert.ok(required.length, 'Pages requirement manifest must declare required secrets');

const args = ['pages', 'secret', 'list', '--project-name', wrangler.name];
const output = await new Promise((resolveRun, reject) => {
  const child = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), ...args], { cwd: root, env: process.env, shell: false });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolveRun(`${stdout}\n${stderr}`) : reject(new Error(`Wrangler could not list Pages secrets (exit ${code}).`)));
});
const clean = String(output).replace(/\u001b\[[0-9;]*m/g, '');
const missing = required.filter(name => !new RegExp(`\\b${name}\\b`).test(clean));
assert.deepEqual(missing, [], `Cloudflare Pages is missing required secrets: ${missing.join(', ')}`);
console.log(`Cloudflare Pages secret gate passed (${required.length}/${required.length} names present; values were not read).`);
