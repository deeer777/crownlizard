import { execFileSync } from 'node:child_process';

const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
if (/^codex\/crazygames(?:-|\/)/.test(branch)) {
  throw new Error(`Refusing Crown Lizard production deploy from isolated platform branch: ${branch}. Merge reviewed changes to main first.`);
}

console.log(`Crown production branch guard passed (${branch || 'detached commit'}).`);
