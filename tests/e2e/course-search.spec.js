import { test, expect } from '@playwright/test'

test.describe('course search', () => {
  test('university and school dropdowns filter the available course areas', async ({ page }) => {
    await page.goto('/courses')
    await expect(page.getByTestId('course-university-select')).toBeVisible()
    await expect(page.getByTestId('course-school-select')).toBeVisible()

    const universitySelect = page.getByTestId('course-university-select')
    const universityOptionCount = await universitySelect.locator('option').count()
    if (universityOptionCount > 1) {
      await universitySelect.selectOption({ index: 1 })
      await expect(universitySelect).not.toHaveValue('')
    }

    const schoolSelect = page.getByTestId('course-school-select')
    const schoolOptionCount = await schoolSelect.locator('option').count()
    if (schoolOptionCount > 1) {
      await schoolSelect.selectOption({ index: 1 })
      await expect(schoolSelect).not.toHaveValue('')
    }

    await page.getByTestId('course-area-search').fill('finance')
    await expect(page.getByTestId('course-clear-filters')).toBeVisible()
    await page.getByTestId('course-clear-filters').click()
    await expect(universitySelect).toHaveValue('')
    await expect(schoolSelect).toHaveValue('')
    await expect(page.getByTestId('course-area-search')).toHaveValue('')
  })

  test('selecting an area opens its mapped course search', async ({ page }) => {
    await page.goto('/courses')
    try {
      await expect(page.getByTestId('course-search-loading')).toHaveCount(0, { timeout: 15000 })
    } catch {
      test.skip(true, 'Course search data is unavailable; configure the Supabase test environment.')
    }

    const firstArea = page.getByTestId('course-area-item').first()
    if (!(await firstArea.count())) test.skip(true, 'No seeded course areas are available.')
    await firstArea.click()

    await expect(page.getByTestId('course-module-search')).toBeVisible()
    await expect(
      page.getByTestId('course-module-list').or(page.getByTestId('course-module-empty'))
    ).toBeVisible()
  })
})

test.describe('course search on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('filters, buttons, and course lists fit the viewport', async ({ page }) => {
    await page.goto('/courses')
    await expect(page.getByTestId('course-university-select')).toBeVisible()
    await page.getByTestId('course-area-search').fill('finance')
    await expect(page.getByTestId('course-clear-filters')).toBeVisible()
    await page.getByTestId('course-clear-filters').click()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalOverflow).toBe(false)
  })
})
