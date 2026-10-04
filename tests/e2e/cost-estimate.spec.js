import { test, expect } from '@playwright/test'

test.describe('cost estimate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/universities')
    await page.getByTestId('university-card-link').first().click()
  })

  test('shows a range in SGD and local currency', async ({ page }) => {
    await expect(page.getByTestId('cost-sgd')).toContainText('SGD')
    await expect(page.getByTestId('cost-local')).toBeVisible()
  })

  test('changing the profile changes the estimate', async ({ page }) => {
    await expect(page.getByTestId('cost-sgd')).toBeVisible()
    const before = await page.getByTestId('cost-sgd').textContent()
    await page.getByTestId('cost-housing-select').selectOption('comfortable')
    await page.getByTestId('cost-food-select').selectOption('eat-out')
    await page.getByTestId('cost-travel-select').selectOption('high')
    await expect(page.getByTestId('cost-sgd')).not.toHaveText(before)
  })
})
