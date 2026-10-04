import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('reviews', () => {
  test('logged-out user is asked to log in', async ({ page }) => {
    await page.goto('/universities')
    await page.getByTestId('university-card-link').first().click()
    await expect(page.getByTestId('review-login-prompt')).toBeVisible()
  })

  test('post a review, it appears in the carousel', async ({ page }) => {
    await login(page)
    await page.goto('/universities')
    await page.getByTestId('university-card-link').first().click()
    const text = `Great exchange ${Date.now()}`
    await page.getByTestId('review-body-input').fill(text)
    await page.getByTestId('review-submit-btn').click()
    await expect(page.getByTestId('review-carousel')).toContainText(text)
  })
})
