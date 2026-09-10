import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Separate from vitest.config.ts on purpose: these tests hit a real local
// Supabase stack over the network and must never be picked up by `npm test`
// or `npm run gate`, which have to stay Docker-free and deterministic.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rls/**/*.test.ts'],
    hookTimeout: 30000,
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
