import { test, expect } from '@playwright/test'

test.describe('universities', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/universities')
    await expect(page.getByTestId('university-card').first()).toBeVisible()
  })

  test('search narrows the results', async ({ page }) => {
    const cards = page.getByTestId('university-card')
    const before = await cards.count()
    const targetName = (await cards.first().getByTestId('university-card-name').innerText()).trim()
    await page.getByTestId('filter-search-input').fill(targetName)
    await expect(page.getByTestId('university-card-name').filter({ hasText: targetName })).toHaveCount(1)
    expect(before).toBeGreaterThan(1)
    expect(await cards.count()).toBeLessThan(before)
  })

  test('no match shows the empty state', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill('zzzzzz')
    await expect(page.getByTestId('universities-empty')).toBeVisible()
  })

  test('region filter and sort', async ({ page }) => {
    await page.getByTestId('filter-region-select').selectOption('Europe')
    const cards = page.getByTestId('university-card-name')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    await page.getByTestId('filter-sort-select').selectOption('name')
    const names = await cards.allTextContents()
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })
})
