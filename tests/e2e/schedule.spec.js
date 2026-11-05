import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('schedule', () => {
  test.skip(
    !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD,
    'set TEST_EMAIL and TEST_PASSWORD to run the schedule tests'
  )

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('university and period selection reveal the current schedule controls', async ({ page }) => {
    // Let the shortlist store finish loading before reading the card's toggle state.
    await page.goto('/shortlist')
    const shortlistState = page
      .getByTestId('shortlist-item')
      .first()
      .or(page.getByTestId('shortlist-empty'))
    await expect(shortlistState).toBeVisible()

    await page.goto('/universities')
    const firstCard = page.getByTestId('university-card').first()
    await expect(firstCard).toBeVisible()
    const addToShortlist = firstCard.getByTestId('shortlist-add-btn')
    const removeFromShortlist = firstCard.getByTestId('shortlist-remove-btn')
    await expect(addToShortlist.or(removeFromShortlist)).toBeVisible()
    if (await addToShortlist.isVisible()) {
      await addToShortlist.click()
      await expect(removeFromShortlist).toBeVisible()
    }

    await page.goto('/schedule')
    await expect(page.getByTestId('schedule-page')).toBeVisible()

    const universitySelect = page.getByTestId('schedule-university-select')
    const universityId = await universitySelect.locator('option').evaluateAll((options) =>
      options.find((option) => option.value && !option.disabled)?.value ?? ''
    )
    test.skip(!universityId, 'Schedule requires a published university in the student shortlist.')
    await universitySelect.selectOption(universityId)
    await expect(page).toHaveURL(/\/schedule\/\d+/)
    await expect(page.getByTestId('module-table')).toBeVisible()
    await expect(page.getByTestId('schedule-block')).toBeVisible()
    await page.getByTestId('schedule-edit-toggle-btn').click()
    await expect(page.getByTestId('module-table')).toContainText('Save')
  })
})
