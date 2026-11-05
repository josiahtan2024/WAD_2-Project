// Runs in the "mobile" project (a Pixel 7 sized, touch browser).
import { test, expect } from './support/fixtures.js'
import { idle, scrollsSideways, signIn, nav } from './support/ui.js'

const PUBLIC_PAGES = ['/', '/about', '/login', '/signup', '/universities', '/universities/2', '/compare', '/courses']
const STUDENT_PAGES = ['/shortlist', '/cost-estimator', '/schedule']

test.describe('mobile: nothing sticks out sideways', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} fits the screen`, async ({ page }) => {
      await page.goto(path)
      await idle(page)
      expect(await scrollsSideways(page)).toBe(false)
    })
  }

  for (const path of STUDENT_PAGES) {
    test(`${path} fits the screen when signed in`, async ({ page, student, backend }) => {
      backend.shortlist(student, [2, 5])
      backend.fillCart(student, 2, ['Game Theory'])
      await signIn(page, student, backend)
      await page.goto(path)
      await idle(page)
      expect(await scrollsSideways(page)).toBe(false)
    })
  }

  test('the compare table with universities chosen fits', async ({ page }) => {
    await page.goto('/compare')
    await idle(page)
    const selects = page.getByTestId('compare-university-select')
    await selects.nth(0).selectOption({ label: 'Boston University' })
    await selects.nth(1).selectOption({ label: 'Kyoto University' })
    expect(await scrollsSideways(page)).toBe(false)
  })

  test('a long review fits', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/universities/7')
    await expect(page.getByTestId('review-carousel')).toBeVisible()
    await page.getByTestId('review-rating-4').click()
    await page.getByTestId('review-body-input').fill('w'.repeat(1800))
    await page.getByTestId('review-submit-btn').click()
    await expect(page.getByTestId('review-delete-btn')).toBeVisible()
    expect(await scrollsSideways(page)).toBe(false)
  })

  test('the saved budgets list fits', async ({ page, student, backend }) => {
    backend.rows('user_budgets').push({ id: 1, user_id: student.id, university_id: 2, exchange_period_id: 3, duration_months: 4, currency_code: 'USD', total_budget: 13000, accommodation_budget: 1800, food_budget: 800, transport_budget: 150, personal_budget: 500, other_budget: 0 })
    await signIn(page, student, backend)
    await page.goto('/cost-estimator')
    await expect(page.getByTestId('budget-row')).toHaveCount(1)
    expect(await scrollsSideways(page)).toBe(false)
  })
})

test.describe('mobile: the menu', () => {
  test('opens full width from the button and closes again', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('nav-toggle').click()
    const menu = page.locator('#nav-menu')
    await expect(menu).toHaveClass(/show/)
    const box = await menu.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(page.viewportSize().width - 2)
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(menu).not.toHaveClass(/show/)
  })

  test('tapping a link goes there and closes the menu', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('nav-toggle').click()
    await nav(page, 'nav-compare').click()
    await expect(page).toHaveURL(/\/compare$/)
    await expect(page.locator('#nav-menu')).not.toHaveClass(/show/)
  })

  test('shows the cart count and the admin badge inside the menu', async ({ page, admin, backend }) => {
    backend.fillCart(admin, 2, ['Game Theory', 'Business Valuation'])
    await signIn(page, admin, backend)
    await page.goto('/')
    await page.getByTestId('nav-toggle').click()
    await expect(nav(page, 'nav-cart-count')).toHaveText('2')
    await expect(page.locator('.mobile-admin-indicator')).toBeVisible()
  })
})

test.describe('mobile: using the app by touch', () => {
  test('search, open a university, shortlist it', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/universities')
    await page.getByTestId('filter-search-input').fill('Kyoto')
    await expect(page.getByTestId('university-card-name')).toHaveCount(1)
    await page.getByTestId('shortlist-add-btn').tap()
    await expect(page.getByTestId('shortlist-remove-btn')).toBeVisible()
    await page.getByTestId('university-card-link').tap()
    await expect(page).toHaveURL(/\/universities\/5$/)
    expect(backend.rows('shortlists').filter((s) => s.user_id === student.id)).toHaveLength(1)
  })

  test('the buttons are big enough to tap', async ({ page }) => {
    await page.goto('/universities')
    await expect(page.getByTestId('university-card-link').first()).toBeVisible()
    const box = await page.getByTestId('university-card-link').first().boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(28)
  })

  test('the login form works with the on-screen layout', async ({ page, student }) => {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(student.email)
    await page.getByTestId('login-password-input').fill(student.password)
    await page.getByTestId('login-submit-btn').tap()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('the budget planner can be completed', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/cost-estimator')
    await page.getByTestId('budget-create-button').first().tap()
    const select = page.getByTestId('budget-university-select')
    const value = await select.locator('option', { hasText: 'Boston University' }).first().getAttribute('value')
    await select.selectOption(value)
    await page.getByTestId('budget-submit-button').tap()
    await expect(page.getByTestId('notice-success-message')).toBeVisible()
    expect(backend.rows('user_budgets').filter((b) => b.user_id === student.id)).toHaveLength(1)
  })
})
