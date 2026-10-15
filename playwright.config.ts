import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// The CI image and the cloud dev container ship a Chromium at this path;
// elsewhere Playwright uses its own download.
const localChromium = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(localChromium) ? localChromium : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    launchOptions: executablePath ? { executablePath } : {},
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  outputDir: 'test-results',
});
