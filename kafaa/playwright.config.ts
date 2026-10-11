import { defineConfig, devices } from '@playwright/test';

// Chromium is preinstalled at /opt/pw-browsers (never run `playwright install` here).
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/kafaa/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
