import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inputs = [
  'supabase/schema.sql',
  'supabase/weapon-skins-build91.sql',
  'supabase/promo-codes-build92.sql',
  'supabase/market-mvp-build94.sql',
  'supabase/market-signals-build95.sql',
  'supabase/warden-schedule-build96.sql',
  'supabase/security-hardening-build99.sql',
];
const sections = await Promise.all(inputs.map(async path => `\n-- SOURCE: ${path}\n${await readFile(resolve(root, path), 'utf8')}`));
const header = `-- GENERATED FILE. Do not edit directly.\n-- Rebuild with: node tools/build-canonical-schema.mjs\n-- Safe bootstrap order for a new Crown Lizard Supabase project.\n`;
await writeFile(resolve(root, 'supabase/canonical-schema.sql'), `${header}${sections.join('\n')}\n`, 'utf8');
console.log(`Wrote supabase/canonical-schema.sql from ${inputs.length} ordered sources.`);
