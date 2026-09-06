import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const specifications = [
  ['landscape', 'submissions/crazygames/media/crown-lizard-cover-landscape-1920x1080.png', 1920, 1080],
  ['portrait', 'submissions/crazygames/media/crown-lizard-cover-portrait-800x1200.png', 800, 1200],
  ['square', 'submissions/crazygames/media/crown-lizard-cover-square-800x800.png', 800, 800],
];

const pngDimensions = buffer => {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature || buffer.subarray(12, 16).toString('ascii') !== 'IHDR') throw new Error('INVALID_PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

let failed = false;
for (const [label, path, expectedWidth, expectedHeight] of specifications) {
  try {
    const absolute = resolve(root, path);
    const buffer = await readFile(absolute);
    const { width, height } = pngDimensions(buffer);
    const size = (await stat(absolute)).size;
    if (width !== expectedWidth || height !== expectedHeight) throw new Error(`${width}x${height}, expected ${expectedWidth}x${expectedHeight}`);
    console.log(`PASS  ${label} cover: ${width}x${height}, ${(size / 1048576).toFixed(2)} MiB`);
  } catch (error) {
    failed = true;
    console.error(`FAIL  ${label} cover: ${error.message}`);
  }
}

const metadata = JSON.parse(await readFile(resolve(root, 'platforms/crazygames-submission.json'), 'utf8'));
if (metadata.platform !== 'crazygames' || metadata.launch !== 'basic' || metadata.title !== 'Crown Lizard') {
  failed = true;
  console.error('FAIL  submission metadata: invalid platform, launch lane or title');
} else console.log('PASS  submission metadata: CrazyGames Basic Launch');

console.log('INFO  Preview videos remain a manual capture gate because CrazyGames requires genuine gameplay footage.');
if (failed) process.exitCode = 1;
