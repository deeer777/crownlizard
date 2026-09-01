import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './workers/pvp/wrangler.jsonc' } })],
  test: { include: ['workers/pvp/test/**/*.test.ts'] },
});
