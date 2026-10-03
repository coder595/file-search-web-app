import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    // Chromium has the real File System Access API, so it never takes the fallback path.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /fallback\.spec\.ts/ },
    // Clipboard permissions are Chromium-only; Firefox/WebKit reject them.
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], permissions: [] },
      testMatch: /fallback\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], permissions: [] },
      testMatch: /fallback\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
