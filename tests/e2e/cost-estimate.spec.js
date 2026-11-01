import { test, expect } from '@playwright/test'

test.describe('cost estimate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/universities')
    await page.getByTestId('university-card-link').first().click()
  })

  test('shows the published monthly estimate in local currency and SGD', async ({ page }) => {
    await expect(page.getByText('Estimated monthly total')).toBeVisible()
    await expect(page.getByText(/Estimated in SGD:/)).toBeVisible()
    for (const expense of ['Accommodation', 'Food', 'Transport', 'Personal expenses']) {
      await expect(page.getByText(expense, { exact: true })).toBeVisible()
    }
  })
})
