import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [ ['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }] ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 390, height: 844 },
  },
  webServer: [
    {
      command: 'cmd /d /s /c "cd /d jiehe-smart-assistant\\frontend && npm run dev"',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 90_000,
    }
  ],
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
});
