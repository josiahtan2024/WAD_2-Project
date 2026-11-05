// Functional suite: the real built app in a real browser, against a fake Supabase that runs
// inside the tests (tests/functional/support/backend.js). No accounts, secrets or network
// needed, and every test starts from the same data, so it is safe to run in parallel.
//
//   npm run test:functional            run everything
//   npm run test:functional -- --ui    pick tests in Playwright's UI
//   npx playwright show-report playwright-report/functional
import { defineConfig, devices } from '@playwright/test'
import { MOCK } from './tests/functional/support/backend.js'

const ci = !!process.env.CI
const PORT = 5174

export default defineConfig({
  testDir: './tests/functional',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/functional' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  // Build once and serve the build: it is what ships, and it avoids the dev server reloading
  // the page when it discovers a dependency halfway through a test.
  webServer: {
    command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: MOCK.url, VITE_SUPABASE_ANON_KEY: MOCK.anonKey },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.js/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.js/ },
  ],
})
