import { test, expect } from './support/fixtures.js'
import { idle, signIn, texts, nav } from './support/ui.js'

const areas = (page) => page.getByTestId('course-area-item')
const modules = (page) => page.getByTestId('course-module-item')
const cartItems = (page) => page.getByTestId('course-cart-item')
const cartCount = (page) => page.getByTestId('course-cart-count')
const areaButton = (page, code) => areas(page).filter({ hasText: code })

async function openCourses(page, query = '') {
  await page.goto(`/courses${query}`)
  await expect(page.getByTestId('course-search-loading')).toBeHidden()
  await idle(page)
}

async function chooseArea(page, code) {
  await areaButton(page, code).click()
  await expect(areaButton(page, code)).toHaveAttribute('aria-pressed', 'true')
}

test.describe('course search: finding courses', () => {
  test('lists the SMU course areas that have a mapped course', async ({ page }) => {
    await openCourses(page)
    // XACC900 (Accounting) has nothing mapped to it, so it is hidden by default
    await expect(areas(page)).toHaveCount(9)
    await expect(areaButton(page, 'XACC900')).toHaveCount(0)
    await expect(page.getByTestId('course-area-count')).toHaveText(/Showing\s*9\s*of 10 course areas/)
  })

  test('can include areas with nothing mapped', async ({ page }) => {
    await openCourses(page)
    await page.getByLabel('Only Show Course Areas with Mapped Courses').uncheck()
    await expect(areas(page)).toHaveCount(10)
    await expect(areaButton(page, 'XACC900')).toContainText('0')
  })

  test('asks for an area before listing courses', async ({ page }) => {
    await openCourses(page)
    await expect(page.getByTestId('course-area-placeholder')).toBeVisible()
    await expect(modules(page)).toHaveCount(0)
  })

  test('shows the mapped courses of a chosen area, grouped by university', async ({ page }) => {
    await openCourses(page)
    await chooseArea(page, 'XECO900')
    const headings = await texts(page.getByTestId('course-module-list').getByRole('heading', { level: 3 }))
    expect(headings).toEqual([...headings].sort((a, b) => a.localeCompare(b)))
    expect(headings).toContain('Boston University')
    expect(headings).toContain('Kyoto University')
    await expect(modules(page).filter({ hasText: 'Game Theory' })).toHaveCount(1)
    await expect(page.getByText(/\d+ courses across all partners/)).toBeVisible()
  })

  test('the count on an area matches the courses listed under it', async ({ page }) => {
    await openCourses(page)
    const badge = Number(await areaButton(page, 'XBBM903').locator('.area-count-badge').innerText())
    await chooseArea(page, 'XBBM903')
    await expect(modules(page)).toHaveCount(badge)
  })

  test('narrows everything to one university', async ({ page }) => {
    await openCourses(page)
    await page.getByTestId('course-university-select').selectOption({ label: 'Boston University' })
    await expect(page).toHaveURL(/university=2/)
    await expect(areas(page)).toHaveCount(6) // Boston maps to six areas
    await chooseArea(page, 'XECO900')
    await expect(modules(page)).toHaveCount(3)
    await expect(page.getByText('3 courses at Boston University')).toBeVisible()
  })

  test('searches areas by code or description', async ({ page }) => {
    await openCourses(page)
    await page.getByTestId('course-area-search').fill('xeco')
    await expect(areas(page)).toHaveCount(1)
    await page.getByTestId('course-area-search').fill('Finance')
    await expect(areas(page)).toHaveCount(1)
    await expect(areaButton(page, 'XBBM903')).toBeVisible()
    await page.getByTestId('course-area-search').fill('zzz')
    await expect(page.getByTestId('course-area-empty')).toHaveText('No course areas match these filters.')
  })

  test('filters areas by SMU school', async ({ page }) => {
    await openCourses(page)
    await page.getByTestId('course-school-select').selectOption('School of Social Sciences')
    const codes = await texts(areas(page).locator('.fw-semibold'))
    expect(codes.sort()).toEqual(['XFE902', 'XSSC902', 'XSSC903'])
  })

  test('searches within the mapped courses by name', async ({ page }) => {
    await openCourses(page)
    await chooseArea(page, 'XECO900')
    await page.getByTestId('course-module-search').fill('game')
    await expect(modules(page)).toHaveCount(1)
    await page.getByTestId('course-module-search').fill('nothing like this')
    await expect(page.getByTestId('course-module-empty')).toContainText('No mapped courses for this area')
  })

  test('says so when the chosen university has nothing in that area', async ({ page }) => {
    await openCourses(page)
    await chooseArea(page, 'XECO900')
    await page.getByTestId('course-university-select').selectOption({ label: 'University of Pretoria' })
    await expect(page.getByTestId('course-module-empty')).toContainText('at this university')
  })

  test('reset brings every filter back to the start', async ({ page }) => {
    await openCourses(page)
    await expect(page.getByTestId('course-clear-filters')).toHaveCount(0)
    await page.getByTestId('course-university-select').selectOption({ label: 'Boston University' })
    await chooseArea(page, 'XECO900')
    await page.getByTestId('course-area-search').fill('eco')
    await page.getByTestId('course-clear-filters').click()
    await expect(page.getByTestId('course-university-select')).toHaveValue('')
    await expect(page.getByTestId('course-area-search')).toHaveValue('')
    await expect(page.getByTestId('course-area-placeholder')).toBeVisible()
    await expect(page.getByTestId('course-clear-filters')).toHaveCount(0)
  })

  test('the search can be shared as a link', async ({ page }) => {
    await openCourses(page, '?university=2&area=3')
    await expect(page.getByTestId('course-university-select')).toHaveValue('2')
    await expect(areaButton(page, 'XECO900')).toHaveAttribute('aria-pressed', 'true')
    await expect(modules(page)).toHaveCount(3)
  })

  test('puts shortlisted universities first in the dropdown', async ({ page, student, backend }) => {
    backend.shortlist(student, [5])
    await signIn(page, student, backend)
    await openCourses(page)
    await expect(page.getByTestId('course-university-select').locator('optgroup[label="My Shortlist"]')).toContainText('Kyoto University')
  })

  test('does not offer a hidden university to students', async ({ page }) => {
    await openCourses(page)
    expect(await texts(page.getByTestId('course-university-select').locator('option'))).not.toContain('Atlantis Institute')
  })
})

test.describe('course search: logged out', () => {
  test('lets a visitor search but not add', async ({ page }) => {
    await openCourses(page)
    await chooseArea(page, 'XECO900')
    await expect(page.getByTestId('course-add-btn')).toHaveCount(0)
    await expect(page.getByTestId('course-cart-login')).toBeVisible()
  })

  test('the login link brings the visitor back to the same search', async ({ page }) => {
    await openCourses(page, '?university=2&area=3')
    await page.getByTestId('course-cart-login').getByRole('link', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/login/)
    const redirect = new URL(page.url()).searchParams.get('redirect')
    expect(redirect).toContain('/courses')
    expect(redirect).toContain('university=2')
  })

  test('the navbar shows no cart count', async ({ page }) => {
    await openCourses(page)
    await expect(nav(page, 'nav-cart-count')).toHaveCount(0)
  })
})

test.describe('course search: the cart', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
  })

  test('starts empty', async ({ page }) => {
    await openCourses(page)
    await expect(page.getByTestId('course-cart-empty')).toBeVisible()
    await expect(cartCount(page)).toHaveText('0')
  })

  test('adds a course, saving it for this student', async ({ page, student, backend }) => {
    await openCourses(page)
    await chooseArea(page, 'XECO900')
    await modules(page).filter({ hasText: 'Game Theory' }).getByTestId('course-add-btn').click()
    await expect(modules(page).filter({ hasText: 'Game Theory' }).getByTestId('course-remove-btn')).toContainText('Added')
    await expect(cartItems(page)).toHaveCount(1)
    await expect(cartItems(page)).toContainText('Game Theory')
    await expect(cartItems(page)).toContainText('XECO900')
    await expect(cartCount(page)).toHaveText('1')
    const saved = backend.rows('cart_modules').filter((c) => c.user_id === student.id)
    expect(saved).toHaveLength(1)
    expect(saved[0].university_id).toBe(2)
  })

  test('shows the count in the navbar', async ({ page }) => {
    await openCourses(page)
    await chooseArea(page, 'XECO900')
    await modules(page).first().getByTestId('course-add-btn').click()
    await modules(page).nth(1).getByTestId('course-add-btn').click()
    await expect(cartCount(page)).toHaveText('2')
    await page.getByTestId('nav-toggle').click()
    await expect(nav(page, 'nav-cart-count')).toHaveText('2')
  })

  test('removes a course from the list or from the cart', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, ['Game Theory', 'Business Valuation'])
    await openCourses(page)
    await expect(cartItems(page)).toHaveCount(2)
    await page.getByRole('button', { name: 'Remove Game Theory' }).click()
    await expect(cartItems(page)).toHaveCount(1)
    expect(backend.rows('cart_modules').filter((c) => c.user_id === student.id)).toHaveLength(1)
    await chooseArea(page, 'XBBM903')
    await modules(page).filter({ hasText: 'Business Valuation' }).getByTestId('course-remove-btn').click()
    await expect(page.getByTestId('course-cart-empty')).toBeVisible()
    expect(backend.rows('cart_modules').filter((c) => c.user_id === student.id)).toHaveLength(0)
  })

  test('is remembered after a reload', async ({ page, student, backend }) => {
    backend.fillCart(student, 5)
    await openCourses(page)
    await expect(cartItems(page)).toHaveCount(2)
    await page.reload()
    await expect(cartItems(page)).toHaveCount(2)
  })

  test('is private to the student', async ({ page, student, backend }) => {
    backend.fillCart(backend.createUser(), 2, ['Game Theory'])
    backend.fillCart(student, 5, ['Microeconomics'])
    await openCourses(page)
    await expect(cartItems(page)).toHaveCount(1)
    await expect(cartItems(page)).toContainText('Microeconomics')
  })

  test('groups by university and links to the schedule for each', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, ['Game Theory'])
    backend.fillCart(student, 5, ['Microeconomics'])
    await openCourses(page)
    await expect(page.getByTestId('course-cart-group')).toHaveCount(2)
    await page.getByTestId('course-cart-group').filter({ hasText: 'Kyoto University' }).getByTestId('course-cart-schedule-link').click()
    await expect(page).toHaveURL(/\/schedule\/5(\?period=\d+)?$/)
  })

  test('with a university picked, other universities\' courses are tucked away', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, ['Game Theory'])
    backend.fillCart(student, 5, ['Microeconomics', 'Elementary Japanese'])
    await openCourses(page)
    await page.getByTestId('course-university-select').selectOption({ label: 'Boston University' })
    await expect(cartItems(page)).toHaveCount(1)
    await expect(page.getByTestId('course-cart-hidden')).toContainText('+2 courses for other universities')
    await page.getByTestId('course-cart-show-all').click()
    await expect(cartItems(page)).toHaveCount(3)
    await expect(page.getByTestId('course-cart-showing-all')).toBeVisible()
    await page.getByTestId('course-cart-show-less').click()
    await expect(cartItems(page)).toHaveCount(1)
  })

  test('says so when the picked university has nothing in the cart', async ({ page, student, backend }) => {
    backend.fillCart(student, 5, ['Microeconomics'])
    await openCourses(page)
    await page.getByTestId('course-university-select').selectOption({ label: 'Boston University' })
    await expect(page.getByTestId('course-cart-empty-university')).toContainText('No courses in your cart for Boston University')
  })

  test('clear removes only what is shown', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, ['Game Theory'])
    backend.fillCart(student, 5, ['Microeconomics'])
    await openCourses(page)
    await page.getByTestId('course-university-select').selectOption({ label: 'Boston University' })
    await expect(page.getByTestId('course-cart-clear-btn')).toHaveText('Clear Boston University')
    await page.getByTestId('course-cart-clear-btn').click()
    await expect(page.getByTestId('course-cart-empty-university')).toBeVisible()
    expect(backend.rows('cart_modules').filter((c) => c.user_id === student.id).map((c) => c.university_id)).toEqual([5])
  })

  test('clear cart empties everything when no university is picked', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, ['Game Theory'])
    backend.fillCart(student, 5, ['Microeconomics'])
    await openCourses(page)
    await page.getByTestId('course-cart-clear-btn').click()
    await expect(page.getByTestId('course-cart-empty')).toBeVisible()
    expect(backend.rows('cart_modules').filter((c) => c.user_id === student.id)).toHaveLength(0)
  })

  test('stops at 10 courses for one university', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, [
      'Game Theory', 'Economics of the Labor Market', 'Money and Financial Markets', 'International Financial Management',
      'Business Valuation', 'Derivatives Securities', 'Digital Marketing Analytics', 'International Marketing',
      'Immigration and Development in Asia', 'Great Philosophers',
    ])
    await openCourses(page)
    await chooseArea(page, 'XISM927')
    await page.getByTestId('course-university-select').selectOption({ label: 'Boston University' })
    await modules(page).first().getByTestId('course-add-btn').click()
    await expect(page.getByTestId('course-cart-limit-popup')).toContainText('limit of 10 modules for Boston University')
    await expect(cartItems(page)).toHaveCount(10)
    expect(backend.rows('cart_modules').filter((c) => c.user_id === student.id)).toHaveLength(10)
  })

  test('the 10 limit is per university, not overall', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, [
      'Game Theory', 'Economics of the Labor Market', 'Money and Financial Markets', 'International Financial Management',
      'Business Valuation', 'Derivatives Securities', 'Digital Marketing Analytics', 'International Marketing',
      'Immigration and Development in Asia', 'Great Philosophers',
    ])
    await openCourses(page)
    await chooseArea(page, 'XECO900')
    await page.getByTestId('course-university-select').selectOption({ label: 'Kyoto University' })
    await modules(page).first().getByTestId('course-add-btn').click()
    await expect(page.getByTestId('course-cart-limit-popup')).toHaveCount(0)
    await expect(page.getByTestId('course-cart-group').filter({ hasText: 'Kyoto University' })).toBeVisible()
  })

  test('shows the cart error when saving fails and keeps the cart unchanged', async ({ page, backend }) => {
    await openCourses(page)
    await chooseArea(page, 'XECO900')
    backend.fail('/rest/v1/cart_modules', { status: 500, body: { message: 'database is down' }, times: 1 })
    await modules(page).first().getByTestId('course-add-btn').click()
    await expect(page.getByTestId('course-cart-error')).toContainText('database is down')
    await expect(cartCount(page)).toHaveText('0')
    await expect(modules(page).first().getByTestId('course-add-btn')).toBeEnabled()
  })

  test('adding twice quickly adds once', async ({ page, student, backend }) => {
    await openCourses(page)
    await chooseArea(page, 'XECO900')
    backend.slow('/rest/v1/cart_modules', 400)
    const add = modules(page).first().getByTestId('course-add-btn')
    await add.click()
    await expect(modules(page).first().getByRole('button')).toBeDisabled()
    await expect(modules(page).first().getByTestId('course-remove-btn')).toBeEnabled()
    expect(backend.rows('cart_modules').filter((c) => c.user_id === student.id)).toHaveLength(1)
  })
})

test.describe('course search: failures', () => {
  test('shows an error when the course data cannot be loaded', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    backend.fail('/rest/v1/smu_modules', { status: 500, body: { message: 'cannot read courses' } })
    await page.goto('/courses')
    await expect(page.getByTestId('course-search-error')).toContainText('cannot read courses')
  })
})
