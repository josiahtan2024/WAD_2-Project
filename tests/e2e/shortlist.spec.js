import { test, expect } from '@playwright/test'
import { login, clearShortlist } from './helpers'

test.beforeEach('shortlist', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await clearShortlist(page)
  })

  test('add, persist after reload, remove', async ({ page }) => {
    await page.goto('/universities')
    const firstCard = page.getByTestId('university-card').first()
    await firstCard.getByTestId('shortlist-add-btn').click()
    await expect(firstCard.getByTestId('shortlist-remove-btn')).toBeVisible()
    await page.goto('/shortlist')
    await expect(page.getByTestId('shortlist-item')).toHaveCount(1)
    await page.reload()
    await expect(page.getByTestId('shortlist-item')).toHaveCount(1)
    await page.getByTestId('shortlist-remove-btn').click()
    await expect(page.getByTestId('shortlist-empty')).toBeVisible()
  })

  test('university details can add and remove the university from shortlist', async ({ page }) => {
    await page.goto('/universities')
    await page.getByTestId('university-card-link').first().click()

    const button = page.getByTestId('university-shortlist-btn')
    await expect(button).toHaveText('Add to Shortlist')
    await button.click()
    await expect(button).toHaveText('Remove from Shortlist')
    await button.click()
    await expect(button).toHaveText('Add to Shortlist')
  })
})
