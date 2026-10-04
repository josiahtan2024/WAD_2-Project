import { test, expect } from '@playwright/test'
import { login } from './helpers'

// Drag-and-drop is student-owned. Fill in the drag step once WeeklyGrid and ScheduleBlock exist.
test.describe('schedule', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('drag a block, save, reload, block is still there', async ({ page }) => {
    await page.goto('/universities')
    await page.getByTestId('university-card-link').first().click()
    const id = page.url().split('/').pop()
    await page.goto(`/schedule/${id}`)
    // TODO(student): drag a [data-testid=schedule-block] onto [data-testid=schedule-grid]
    await page.getByTestId('schedule-save-btn').click()
    await expect(page.getByTestId('schedule-saved')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('schedule-grid').getByTestId('schedule-block')).toHaveCount(1)
  })
})
