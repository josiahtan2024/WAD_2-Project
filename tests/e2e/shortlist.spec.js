import { test, expect } from '@playwright/test'
import { login, clearShortlist } from './helpers'

test.describe('shortlist', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await clearShortlist(page)
  })

  test('add, persist after reload, remove', async ({ page }) => {
    await page.goto('/universities')
    await page.getByTestId('shortlist-add-btn').first().click()
    await page.goto('/shortlist')
    await expect(page.getByTestId('shortlist-item')).toHaveCount(1)
    await page.reload()
    await expect(page.getByTestId('shortlist-item')).toHaveCount(1)
    await page.getByTestId('shortlist-remove-btn').click()
    await expect(page.getByTestId('shortlist-empty')).toBeVisible()
  })
})
