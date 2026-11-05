// Shared helpers. Test accounts come from environment variables (see README).
import { expect } from '@playwright/test'

export const TEST_EMAIL = process.env.TEST_EMAIL || ''
export const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
export const hasStudentCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD)

export async function login(page) {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(TEST_EMAIL)
  await page.getByTestId('login-password-input').fill(TEST_PASSWORD)
  await page.getByTestId('login-submit-btn').click()
  const logoutButton = page.getByTestId('nav-logout-btn')
  const loginError = page.getByTestId('login-error')
  // On phone widths the logout button is inside the collapsed nav, so wait for
  // it to be attached instead of visible. Auth can take longer on a cold run.
  await expect(logoutButton.first().or(loginError)).toBeAttached({ timeout: 30000 })
  if (await loginError.isVisible()) {
    throw new Error(`Test account login failed: ${await loginError.innerText()}`)
  }
}

// Remove every shortlisted university so each test starts clean.
export async function clearShortlist(page) {
  await page.goto('/shortlist')
  await expect(page.getByTestId('shortlist-loading')).toHaveCount(0)
  const remove = page.getByTestId('shortlist-remove-btn')
  while (await remove.count()) {
    const previousCount = await remove.count()
    await remove.first().click()
    await expect(remove).toHaveCount(previousCount - 1)
  }
}
