import { test, expect } from '@playwright/test'
import { TEST_EMAIL, TEST_PASSWORD, login } from './helpers'

test.describe('auth', () => {
  test('logged-out user is redirected from a protected page', async ({ page }) => {
    await page.goto('/shortlist')
    await expect(page.getByTestId('login-page')).toBeVisible()
  })

  test('log in and log out', async ({ page }) => {
    await login(page)
    await page.getByTestId('nav-logout-btn').click()
    await expect(page.getByTestId('nav-login-link')).toBeVisible()
  })

  test('wrong password shows an error', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(TEST_EMAIL)
    await page.getByTestId('login-password-input').fill(TEST_PASSWORD + 'x')
    await page.getByTestId('login-submit-btn').click()
    await expect(page.getByTestId('login-error')).toBeVisible()
  })

  test('signup page is reachable', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByTestId('signup-submit-btn')).toBeVisible()
  })
})
