import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/universities')
  await expect(page.getByTestId('university-card').first()).toBeVisible()
})

test('universities: search narrows the results', async ({ page }) => {
  const cards = page.getByTestId('university-card')
  const before = await cards.count()
  const targetName = (await cards.first().getByTestId('university-card-name').innerText()).trim()
  await page.getByTestId('filter-search-input').fill(targetName)
  await expect(page.getByTestId('university-card-name').filter({ hasText: targetName })).toHaveCount(1)
  expect(before).toBeGreaterThan(1)
  expect(await cards.count()).toBeLessThan(before)
})

test('universities: no match shows the empty state', async ({ page }) => {
  await page.getByTestId('filter-search-input').fill('zzzzzz')
  await expect(page.getByTestId('universities-empty')).toBeVisible()
})

test('universities: region filter and sort', async ({ page }) => {
  await page.getByTestId('filter-region-select').selectOption('Europe')
  const cards = page.getByTestId('university-card-name')
  const count = await cards.count()
  expect(count).toBeGreaterThan(0)
  await page.getByTestId('filter-sort-select').selectOption('name')
  const names = await cards.allTextContents()
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
})

test('universities: credit mappings can be filtered by SMU school', async ({ page }) => {
  await page.getByTestId('university-card-link').first().click()
  await expect(page.getByTestId('university-page')).toBeVisible()
  await expect(page.getByTestId('mapping-loading')).toHaveCount(0)

  const schoolFilter = page.getByTestId('mapping-school-filter')
  if (!(await schoolFilter.count())) {
    test.skip(true, 'This university has no course mappings to filter.')
  }

  await page.getByTestId('credit-mapping-table').locator('summary').first().click()
  await expect(schoolFilter).toBeVisible()
  await expect(schoolFilter.locator('option').nth(1)).toBeAttached()
  await schoolFilter.selectOption({ index: 1 })
  await expect(schoolFilter).not.toHaveValue('')
  await expect(page.getByTestId('mapping-clear-filters')).toBeVisible()
  await page.getByTestId('mapping-clear-filters').click()
  await expect(schoolFilter).toHaveValue('')
})
