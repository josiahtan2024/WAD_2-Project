import { test, expect } from '@playwright/test'
import { login, clearShortlist } from './helpers'

test.describe('compare', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await clearShortlist(page)
  })

  test('empty shortlist leaves all comparison slots unselected', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-heading')).toBeVisible()
    const slots = page.getByTestId('compare-university-select')
    await expect(slots).toHaveCount(3)
    for (const slot of await slots.all()) await expect(slot).toHaveValue('')
  })

  test('shortlisted universities can be selected for comparison', async ({ page }) => {
    await page.goto('/universities')
    const cards = page.getByTestId('university-card')
    const firstCard = cards.nth(0)
    const secondCard = cards.nth(1)
    const firstName = (await firstCard.getByTestId('university-card-name').innerText()).trim()
    const secondName = (await secondCard.getByTestId('university-card-name').innerText()).trim()
    await firstCard.getByTestId('shortlist-add-btn').click()
    await expect(firstCard.getByTestId('shortlist-remove-btn')).toBeVisible()
    await secondCard.getByTestId('shortlist-add-btn').click()
    await expect(secondCard.getByTestId('shortlist-remove-btn')).toBeVisible()
    await page.goto('/compare')

    const slots = page.getByTestId('compare-university-select')
    const firstValue = await slots.nth(0).locator('option').filter({ hasText: firstName }).getAttribute('value')
    const secondValue = await slots.nth(1).locator('option').filter({ hasText: secondName }).getAttribute('value')
    await slots.nth(0).selectOption(firstValue)
    await slots.nth(1).selectOption(secondValue)
    await expect(slots.nth(0)).toHaveValue(firstValue)
    await expect(slots.nth(1)).toHaveValue(secondValue)
  })
})
