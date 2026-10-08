import { defineConfig } from 'vitest/config';
// [G1] also collects .test.tsx (component tests opt into jsdom with a `// @vitest-environment jsdom` docblock).
export default defineConfig({ test: { include: ['tests/unit/**/*.test.{ts,tsx}'], environment: 'node' } });
