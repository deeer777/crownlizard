import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const tests = (await readdir(resolve('test'))).filter(name => name.endsWith('.mjs')).sort();
for (const test of tests) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [resolve('test', test)], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveRun() : reject(new Error(`${test} failed with exit code ${code}`)));
  });
}
console.log(`Passed ${tests.length} Crown Lizard test files.`);
