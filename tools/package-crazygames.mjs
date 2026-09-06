import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'dist-crazygames');
const artifacts = resolve(root, 'artifacts');
const release = JSON.parse(await readFile(resolve(root, 'release.json'), 'utf8'));
const baseName = `crown-lizard-crazygames-build-${release.build}`;
const zipPath = resolve(artifacts, `${baseName}.zip`);

const walk = async directory => {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result.sort((a, b) => a.localeCompare(b));
};

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});
const crc32 = buffer => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const u16 = value => { const buffer = Buffer.alloc(2); buffer.writeUInt16LE(value); return buffer; };
const u32 = value => { const buffer = Buffer.alloc(4); buffer.writeUInt32LE(value >>> 0); return buffer; };

const locals = [];
const central = [];
let offset = 0;
for (const path of await walk(source)) {
  const name = Buffer.from(relative(source, path).split(sep).join('/'));
  const original = await readFile(path);
  const candidate = deflateRawSync(original, { level: 9 });
  const compressed = candidate.length < original.length ? candidate : original;
  const method = compressed === original ? 0 : 8;
  const crc = crc32(original);
  const local = Buffer.concat([
    u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(0), u16(0x5c21),
    u32(crc), u32(compressed.length), u32(original.length), u16(name.length), u16(0), name, compressed,
  ]);
  locals.push(local);
  central.push(Buffer.concat([
    u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(method), u16(0), u16(0x5c21),
    u32(crc), u32(compressed.length), u32(original.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
  ]));
  offset += local.length;
}
const centralBuffer = Buffer.concat(central);
const archive = Buffer.concat([
  ...locals,
  centralBuffer,
  u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(centralBuffer.length), u32(offset), u16(0),
]);
await mkdir(artifacts, { recursive: true });
await writeFile(zipPath, archive);
const sha256 = createHash('sha256').update(archive).digest('hex');
await writeFile(resolve(artifacts, `${baseName}.sha256`), `${sha256}  ${baseName}.zip\n`);
console.log(`Packaged ${relative(root, zipPath)} (${(archive.length / 1048576).toFixed(2)} MiB)`);
console.log(`SHA-256 ${sha256}`);
