import { test, expect } from '@playwright/test'
import { login, clearShortlist } from './helpers'

test.describe('compare', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await clearShortlist(page)
  })

  test('empty shortlist shows the empty state', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-empty')).toBeVisible()
  })

  test('table shows the shortlisted universities', async ({ page }) => {
    await page.goto('/universities')
    await page.getByTestId('shortlist-add-btn').nth(0).click()
    await expect(page.getByTestId('shortlist-remove-btn')).toHaveCount(1)
    await page.getByTestId('shortlist-add-btn').nth(0).click()
    await expect(page.getByTestId('shortlist-remove-btn')).toHaveCount(2)
    await page.goto('/compare')
    await expect(page.getByTestId('compare-col')).toHaveCount(2)
  })
})
