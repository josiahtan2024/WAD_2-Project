import { defineConfig, devices } from '@playwright/test'

const ci = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: ci, // fail CI if a test.only is left in
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !ci,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
