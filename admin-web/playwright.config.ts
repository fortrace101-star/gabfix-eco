import { defineConfig } from '@playwright/test';

/**
 * Smoke suite for the admin console. It drives the real dev server against the
 * local Supabase seed, so it expects the stack from the README: `npm run dev`
 * plus the seeded `admin@gabfix.ug` account.
 *
 * `channel: 'chrome'` uses the Chrome that is already installed instead of
 * downloading a Playwright browser.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
