import { test, expect } from '@playwright/test'

test.use({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})

async function expectNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(hasOverflow).toBe(false)
}

async function openFirstPopulatedRegion(page) {
  await page.getByTestId('home-university-list').waitFor()

  const regionButtons = page.getByTestId('home-region-toggle')
  const regionIndex = await regionButtons.evaluateAll((buttons) =>
    buttons.findIndex((button) => Number(button.querySelector('[data-testid="home-region-count"]')?.textContent) > 0)
  )
  expect(regionIndex).toBeGreaterThanOrEqual(0)

  await regionButtons.nth(regionIndex).click()
}

test('menu opens, navigates, and closes after choosing a page', async ({ page }) => {
  await page.goto('/universities')
  const toggle = page.getByTestId('nav-toggle')

  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.getByTestId('nav-courses').last().click()

  await expect(page).toHaveURL(/\/courses$/)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('course-search-page')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('home map controls work at phone width and the footer remains reachable', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('home-page')).toBeVisible()
  await expect(page.getByTestId('map-panel')).toBeVisible()
  await expect(page.getByTestId('map-reset-button')).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const footer = page.getByTestId('app-footer')
  await footer.scrollIntoViewIfNeeded()
  await expect(footer).toBeVisible()

  await openFirstPopulatedRegion(page)
  const allRegions = page.getByTestId('map-all-regions-toggle')
  await expect(allRegions).toBeVisible()
  await allRegions.click()
  await expect(allRegions).toHaveText('Regions')

  await openFirstPopulatedRegion(page)
  await page.getByTestId('map-reset-button').click()
  await expect(allRegions).toHaveText('Regions')
})

test('map details link opens in the current tab', async ({ page, context }) => {
  await page.goto('/')
  await openFirstPopulatedRegion(page)
  await page.getByTestId('map-university-item').first().click()
  await page.getByTestId('info-details-link').click()

  await expect(page).toHaveURL(/\/universities\/\d+$/)
  expect(context.pages()).toHaveLength(1)
})

test('dropdown controls stay within the phone viewport', async ({ page }) => {
  const dropdowns = [
    ['/universities', 'filter-region-select'],
    ['/courses', 'course-university-select'],
    ['/compare', 'compare-university-select'],
  ]

  for (const [path, testId] of dropdowns) {
    await page.goto(path)
    const dropdown = page.getByTestId(testId).first()
    await expect(dropdown).toBeVisible()

    const { width, left, right } = await dropdown.evaluate((element) => {
      const { left, right } = element.getBoundingClientRect()
      return { width: window.innerWidth, left, right }
    })

    expect(left).toBeGreaterThanOrEqual(0)
    expect(right).toBeLessThanOrEqual(width)
  }
})
