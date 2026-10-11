import { defineConfig, devices } from '@playwright/test';

// Full E2E QA against `vite preview` of the production build, in supabase mode against the live NEXUS project.
// Chromium is preinstalled at /opt/pw-browsers (never run `playwright install`). One browser, one worker.
// Build first with VITE_NEXUS_DEMO_PASSWORD in .env.local (never committed): npm run build && npx playwright test -c playwright.e2e.config.ts
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 40 * 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/kafaa/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
