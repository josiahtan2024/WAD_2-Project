import { test, expect } from '@playwright/test'

test.describe('navigation on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('menu opens, navigates, and closes after choosing a page', async ({ page }) => {
    await page.goto('/universities')
    const toggle = page.getByTestId('nav-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await page.getByTestId('nav-courses').click()

    await expect(page).toHaveURL(/\/courses$/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('course-search-page')).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalOverflow).toBe(false)
  })
})
