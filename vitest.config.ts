import { defineConfig } from 'vitest/config';
// [G1] also collects .test.tsx (component tests opt into jsdom with a `// @vitest-environment jsdom` docblock).
// Unit tests run against the in-browser LocalBackend; the app's default backend (supabase) is exercised by the E2E suite.
export default defineConfig({ test: { include: ['tests/unit/**/*.test.{ts,tsx}'], environment: 'node', testTimeout: 30000, env: { VITE_KAFAA_BACKEND: 'local' } } });
