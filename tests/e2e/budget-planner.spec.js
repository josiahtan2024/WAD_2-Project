import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('saved budget planner', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'set TEST_EMAIL and TEST_PASSWORD to run budget planner tests')
  let budgetCreated = false

  test.beforeEach(async ({ page }) => {
    budgetCreated = false
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    if (!budgetCreated) return
    await page.goto('/cost-estimator')
    const newestBudget = page.getByRole('row').nth(1)
    await expect(newestBudget).toBeVisible()
    await newestBudget.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete Budget' }).click()
    budgetCreated = false
  })

  test('create, read, edit, cancel and confirm deletion of a budget', async ({ page }) => {
    await page.route('https://api.frankfurter.dev/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rates: { USD: 0.74, EUR: 0.68, GBP: 0.59, JPY: 110, CAD: 1.01 } }),
    }))

    await page.goto('/cost-estimator')
    await expect(page.getByRole('heading', { name: 'My Budgets' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'No Budgets Yet' }).or(page.locator('table.budget-table'))
    ).toBeVisible()
    // Capture existing rows before opening the planner, which unmounts the list.
    // The database allows only one budget per user and university.
    const savedRows = await page.locator('tbody tr').allTextContents()
    await page.getByRole('button', { name: /Create (New|Your First) Budget/ }).first().click()

    const university = page.locator('#university')
    const [, universityOptions] = await Promise.all([
      page.locator('tbody tr').allTextContents(),
      university.locator('option').evaluateAll((options) => options.slice(1).map((option) => ({
        value: option.value,
        name: option.textContent.split(/\s+(?:â€”|—|–|-)\s+/u)[0].trim(),
      }))),
    ])
    const availableUniversity = universityOptions.find((option) =>
      !savedRows.some((row) => row.includes(option.name))
    )
    if (!availableUniversity) {
      test.skip(true, 'Budget tests need a published university without an existing budget for this account.')
    }
    await university.selectOption(availableUniversity.value)
    await page.locator('#duration').fill('4')
    const totalBeforeExpenses = await page.getByTestId('budget-total').innerText()
    await page.locator('#accommodation').fill('1200')
    await page.locator('#food').fill('450')
    await page.locator('#transport').fill('120')
    await page.locator('#personalExpenses').fill('180')
    await page.locator('#otherExpenses').fill('50')
    await expect(page.getByTestId('budget-total')).not.toHaveText(totalBeforeExpenses)

    await page.getByRole('button', { name: 'Create Budget' }).click()
    await expect(page.getByText('Your new budget has been created successfully.')).toBeVisible()
    budgetCreated = true
    const createdBudget = page.getByRole('row').filter({ hasText: availableUniversity.name })
    await expect(createdBudget).toHaveCount(1)
    await page.getByRole('button', { name: 'Dismiss success message' }).click()

    const newestBudget = page.getByRole('row').nth(1)
    await expect(newestBudget).toContainText('4 months')
    await newestBudget.getByRole('button', { name: 'Read' }).click()
    const details = page.getByRole('dialog')
    await expect(details).toBeVisible()
    await expect(details).toContainText('4 months')
    await details.getByRole('button', { name: 'Close', exact: true }).click()

    await newestBudget.getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('#duration')).toHaveValue('4')
    await page.locator('#duration').fill('5')
    await page.getByRole('button', { name: 'Update Budget' }).click()
    await expect(page.getByText('Your budget has been updated successfully.')).toBeVisible()

    const updatedBudget = page.getByRole('row').nth(1)
    await expect(updatedBudget).toContainText('5 months')
    await updatedBudget.getByRole('button', { name: 'Delete' }).click()
    const confirmation = page.getByRole('dialog')
    await expect(confirmation).toBeVisible()
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('row').nth(1)).toContainText('5 months')

    await page.getByRole('row').nth(1).getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete Budget' }).click()
    await expect(page.getByText('Budget deleted successfully.')).toBeVisible()
    budgetCreated = false
  })
})
