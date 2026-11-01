import { test, expect } from '@playwright/test'

test.describe('cost estimate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/universities')
    await page.getByTestId('university-card-link').first().click()
  })

  test('shows the published monthly estimate in local currency and SGD', async ({ page }) => {
    await expect(page.getByTestId('university-monthly-total-label')).toBeVisible()
    await expect(page.getByTestId('university-monthly-total-sgd')).toBeVisible()
    for (const expense of ['accommodation', 'food', 'transport', 'personal']) {
      await expect(page.getByTestId(`university-cost-${expense}`)).toBeVisible()
    }
  })
})
