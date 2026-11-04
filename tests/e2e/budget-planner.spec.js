import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('saved budget planner', () => {
  test.skip(
    !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD,
    'set TEST_EMAIL and TEST_PASSWORD to run budget planner tests'
  )
  let budgetCreated = false

  test.beforeEach(async ({ page }) => {
    budgetCreated = false
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    if (!budgetCreated) return
    await page.goto('/cost-estimator')
    const newestBudget = page.getByTestId('budget-row').first()
    await expect(newestBudget).toBeVisible()
    await newestBudget.getByTestId('budget-delete-button').click()
    await page.getByTestId('delete-confirm-action').click()
    budgetCreated = false
  })

  test('create, read, edit, cancel and confirm deletion of a budget', async ({ page }) => {
    await page.route('https://api.frankfurter.dev/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rates: { USD: 0.74, EUR: 0.68, GBP: 0.59, JPY: 110, CAD: 1.01 } }),
      })
    )

    await page.goto('/cost-estimator')
    await expect(page.getByTestId('budget-heading')).toBeVisible()
    await expect(
      page.getByTestId('budget-empty-state').or(page.getByTestId('budget-table'))
    ).toBeVisible()
    // Capture existing rows before opening the planner, which unmounts the list.
    // The database allows only one budget per user and university.
    const savedRows = await page.getByTestId('budget-row').allTextContents()
    await page.getByTestId('budget-create-button').first().click()

    const university = page.getByTestId('budget-university-select')
    const universityOptions = await university.evaluate((select) =>
      Array.from(select.options)
        .slice(1)
        .map((option) => ({
          value: option.value,
          name: option.textContent.split(/\s+(?:—|–|-)\s+/u)[0].trim(),
        }))
    )
    const availableUniversity = universityOptions.find(
      (option) => !savedRows.some((row) => row.includes(option.name))
    )
    if (!availableUniversity) {
      test.skip(
        true,
        'Budget tests need a published university without an existing budget for this account.'
      )
    }
    await university.selectOption(availableUniversity.value)
    await page.getByTestId('budget-duration-input').fill('4')
    const totalBeforeExpenses = await page.getByTestId('budget-total').innerText()
    await page.getByTestId('budget-accommodation-input').fill('1200')
    await page.getByTestId('budget-food-input').fill('450')
    await page.getByTestId('budget-transport-input').fill('120')
    await page.getByTestId('budget-personal-input').fill('180')
    await page.getByTestId('budget-other-input').fill('50')
    await expect(page.getByTestId('budget-total')).not.toHaveText(totalBeforeExpenses)

    await page.getByTestId('budget-submit-button').click()
    await expect(page.getByTestId('notice-success-message')).toContainText(
      'Your new budget has been created successfully.'
    )
    budgetCreated = true
    const createdBudget = page
      .getByTestId('budget-row')
      .filter({ hasText: availableUniversity.name })
    await expect(createdBudget).toHaveCount(1)
    await page.getByTestId('notice-dismiss-success').click()

    const newestBudget = page.getByTestId('budget-row').first()
    await expect(newestBudget).toContainText('4 months')
    await newestBudget.getByTestId('budget-read-button').click()
    const details = page.getByTestId('budget-details-dialog')
    await expect(details).toBeVisible()
    await expect(details).toContainText('4 months')
    await details.getByTestId('budget-details-close').click()

    await newestBudget.getByTestId('budget-edit-button').click()
    await expect(page.getByTestId('budget-duration-input')).toHaveValue('4')
    await page.getByTestId('budget-duration-input').fill('5')
    await page.getByTestId('budget-submit-button').click()
    await expect(page.getByTestId('notice-success-message')).toContainText(
      'Your budget has been updated successfully.'
    )

    const updatedBudget = page.getByTestId('budget-row').first()
    await expect(updatedBudget).toContainText('5 months')
    await updatedBudget.getByTestId('budget-delete-button').click()
    const confirmation = page.getByTestId('delete-confirm-dialog')
    await expect(confirmation).toBeVisible()
    await confirmation.getByTestId('delete-confirm-cancel').click()
    await expect(page.getByTestId('budget-row').first()).toContainText('5 months')

    await page.getByTestId('budget-row').first().getByTestId('budget-delete-button').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(page.getByTestId('notice-success-message')).toContainText(
      'Budget deleted successfully.'
    )
    budgetCreated = false
  })
})
