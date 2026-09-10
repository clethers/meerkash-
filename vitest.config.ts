import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // tests/rls/** needs a live local Supabase stack (Docker) and runs
  // separately via `npm run test:rls` / vitest.rls.config.ts — it must never
  // be picked up here, since `npm test` / `npm run gate` have to stay
  // Docker-free and deterministic in any environment.
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'], exclude: ['tests/rls/**', 'node_modules/**'] },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
