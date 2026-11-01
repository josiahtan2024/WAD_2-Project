import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

const testEnv = loadEnv('test', process.cwd(), '')
for (const key of ['TEST_EMAIL', 'TEST_PASSWORD', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']) {
  process.env[key] ??= testEnv[key]
}

const ci = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  // The authenticated specs share one Supabase test account and mutate its data.
  // Keep them serial so shortlist/review/cart state cannot race between workers.
  workers: 1,
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
