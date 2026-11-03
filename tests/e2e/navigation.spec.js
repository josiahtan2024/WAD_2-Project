import { test, expect } from '@playwright/test'

test.use({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})

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

test('home map controls work at phone width and the footer remains reachable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-page')).toBeVisible()
    await expect(page.getByTestId('map-panel')).toBeVisible()
    await expect(page.locator('.leaflet-control-zoom')).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalOverflow).toBe(false)

    const footer = page.locator('.app-footer')
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toBeVisible()

    await page.getByTestId('home-university-list').waitFor()
    const populatedRegionIndex = await page.locator('.region-header-btn').evaluateAll((buttons) =>
      buttons.findIndex((button) => Number(button.querySelector('.region-count-badge')?.textContent) > 0)
    )
    expect(populatedRegionIndex).toBeGreaterThanOrEqual(0)
    await page.locator('.region-header-btn').nth(populatedRegionIndex).click()
    await expect(page.getByTestId('home-regions-back-btn')).toBeVisible()
    await page.getByTestId('home-regions-back-btn').click()
    await expect(page.getByTestId('home-regions-back-btn')).toHaveCount(0)

    await page.locator('.region-header-btn').nth(populatedRegionIndex).click()
    await expect(page.getByTestId('home-regions-back-btn')).toBeVisible()
    await page.getByRole('button', { name: 'Reset map to world view' }).click()
    await expect(page.getByTestId('home-regions-back-btn')).toHaveCount(0)
})

test('map details link opens in the current tab', async ({ page, context }) => {
    await page.goto('/')
    await page.getByTestId('home-university-list').waitFor()
    const populatedRegionIndex = await page.locator('.region-header-btn').evaluateAll((buttons) =>
      buttons.findIndex((button) => Number(button.querySelector('.region-count-badge')?.textContent) > 0)
    )
    await page.locator('.region-header-btn').nth(populatedRegionIndex).click()
    await page.locator('.university-list-item').first().click()
    await page.getByTestId('info-details-link').click()

    await expect(page).toHaveURL(/\/universities\/\d+$/)
    expect(context.pages()).toHaveLength(1)
})

test('dropdown controls stay within the phone viewport', async ({ page }) => {
    for (const path of ['/universities', '/courses', '/compare']) {
      await page.goto(path)
      await expect(page.locator('select.form-select').first()).toBeVisible()

      const { width, bounds: selectBounds } = await page.evaluate(() => ({
        width: window.innerWidth,
        bounds: [...document.querySelectorAll('select.form-select')].map((select) => {
          const { left, right } = select.getBoundingClientRect()
          return { left, right }
        }),
      }))

      expect(selectBounds.length).toBeGreaterThan(0)
      expect(selectBounds.every(({ left, right }) => left >= 0 && right <= width)).toBe(true)
    }
})
