import { readdir, rename, rm, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';

// These ceilings are based on each category's largest in-game/UI presentation
// at the engine's maximum 2x DPR. Source PNGs stay untouched; only build output
// is resized so Crown and portal releases use the same production sprites.
const MAX_DIMENSION_BY_DIRECTORY = Object.freeze({
  sprites: 512,
  environment: 768,
  enemies: 512,
  perks: 256,
  weapons: 384,
  impacts: 384,
  hazards: 384,
  ui: 640,
  icons: 512,
});

const MAX_DIMENSION_BY_FILE = Object.freeze({
  // Four columns need extra source pixels when the 96px effect tile is shown
  // on a 2x DPR display.
  'sprites/cosmetic-effects-sheet-v1.png': 768,
});

const walk = async directory => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
};

export const optimizeBuildAssets = async (output, label = 'build') => {
  const assetsRoot = resolve(output, 'assets');
  const files = (await walk(assetsRoot)).filter(path => extname(path).toLowerCase() === '.png');
  let beforeBytes = 0;
  let afterBytes = 0;
  let optimizedFiles = 0;

  for (const path of files) {
    const before = (await stat(path)).size;
    beforeBytes += before;
    const relativePath = relative(assetsRoot, path).split(sep).join('/');
    const directory = relativePath.split('/')[0];
    const maxDimension = MAX_DIMENSION_BY_FILE[relativePath] || MAX_DIMENSION_BY_DIRECTORY[directory];
    if (!maxDimension || relativePath.startsWith('runtime/')) {
      afterBytes += before;
      continue;
    }

    const metadata = await sharp(path).metadata();
    const needsResize = Math.max(metadata.width || 0, metadata.height || 0) > maxDimension;
    const temporaryPath = `${path}.optimized.png`;
    let pipeline = sharp(path);
    if (needsResize) {
      pipeline = pipeline.resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.nearest,
      });
    }
    await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toFile(temporaryPath);
    const candidate = (await stat(temporaryPath)).size;
    if (candidate < before) {
      await rm(path);
      await rename(temporaryPath, path);
      afterBytes += candidate;
      optimizedFiles += 1;
    } else {
      await rm(temporaryPath);
      afterBytes += before;
    }
  }

  console.log(`Optimized ${optimizedFiles} ${label} PNG files (${(beforeBytes / 1048576).toFixed(2)} -> ${(afterBytes / 1048576).toFixed(2)} MiB).`);
  return { files: optimizedFiles, beforeBytes, afterBytes };
};

// Backwards-compatible export for any external packaging scripts.
export const optimizeCrazyGamesAssets = output => optimizeBuildAssets(output, 'CrazyGames');


