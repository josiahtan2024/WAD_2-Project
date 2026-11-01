import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('schedule', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'set TEST_EMAIL and TEST_PASSWORD to run the schedule tests')

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('university and period selection reveal the current schedule controls', async ({ page }) => {
    await page.goto('/schedule')
    await expect(page.getByTestId('schedule-page')).toBeVisible()

    const universitySelect = page.getByTestId('schedule-university-select')
    const optionCount = await universitySelect.locator('option').count()
    if (optionCount <= 1) {
      await expect(page.getByTestId('schedule-no-universities')).toBeVisible()
      return
    }

    await universitySelect.selectOption({ index: 1 })
    await expect(page).toHaveURL(/\/schedule\/\d+/)
    await expect(page.getByTestId('schedule-period-select')).toBeVisible()

    const viewMode = page.locator('#view')
    if (await viewMode.count()) {
      await page.locator('label[for="edit"]').click()
      await expect(page.locator('#edit')).toBeChecked()
      await page.locator('label[for="view"]').click()
      await expect(viewMode).toBeChecked()
    } else {
      await page.locator('#create-schedule-btn').click()
      await expect(page.getByTestId('schedule-block')).toBeVisible({ timeout: 5000 })
    }
  })
})
