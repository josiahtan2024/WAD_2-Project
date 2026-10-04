// Shared helpers. Dummy account comes from env vars (see README), never hard-code real passwords.
export const TEST_EMAIL = process.env.TEST_EMAIL || 'dummy@example.com'
export const TEST_PASSWORD = process.env.TEST_PASSWORD || 'dummy-password-123'

export async function login(page) {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(TEST_EMAIL)
  await page.getByTestId('login-password-input').fill(TEST_PASSWORD)
  await page.getByTestId('login-submit-btn').click()
  await page.getByTestId('nav-logout-btn').waitFor()
}

// Remove every shortlisted university so each test starts clean.
export async function clearShortlist(page) {
  await page.goto('/shortlist')
  const remove = page.getByTestId('shortlist-remove-btn')
  while (await remove.count()) {
    await remove.first().click()
  }
}
