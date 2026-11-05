import { test, expect } from './support/fixtures.js'
import { card, idle, openUniversities, signIn, texts } from './support/ui.js'
import { RATES, VISIBLE_UNIVERSITIES, monthlyCostSgd } from './support/seed.js'

const PAGE_SIZE = 6
const names = (page) => texts(page.getByTestId('university-card-name'))
const byName = (a, b) => a.localeCompare(b)
const sgd = (amount) => `SGD ${Math.round(amount).toLocaleString('en-US')}`

const allNames = VISIBLE_UNIVERSITIES.map((u) => u.name).sort(byName)

test.describe('the list', () => {
  test('shows the first page of universities, A to Z, with the total', async ({ page }) => {
    await openUniversities(page)
    expect(await names(page)).toEqual(allNames.slice(0, PAGE_SIZE))
    await expect(page.getByText(`Showing ${allNames.length} of ${allNames.length} partner universities`)).toBeVisible()
  })

  test('each card shows the name, place, region and the monthly cost in SGD', async ({ page }) => {
    await openUniversities(page)
    const boston = card(page, 'Boston University')
    await expect(boston.getByTestId('university-card-name')).toHaveText('Boston University')
    await expect(boston).toContainText('Boston, United States')
    await expect(boston).toContainText('Americas')
    await expect(boston).toContainText(sgd(monthlyCostSgd(2)))
  })

  test('costs in other currencies are converted with the current exchange rate', async ({ page }) => {
    await page.goto('/universities?')
    await page.getByTestId('filter-search-input').fill('kyoto')
    await expect(card(page, 'Kyoto University')).toContainText(sgd(monthlyCostSgd(5))) // JPY
    await page.getByTestId('filter-search-input').fill('zurich')
    await expect(card(page, 'University of Zurich')).toContainText(sgd(monthlyCostSgd(8))) // CHF
    expect(RATES.JPY).toBeGreaterThan(1) // the fixture really is a different currency
  })

  test('every card has a logo that loads, with a useful description', async ({ page }) => {
    await openUniversities(page)
    const logos = page.getByTestId('university-card').locator('img')
    await expect(logos).toHaveCount(PAGE_SIZE)
    for (const logo of await logos.all()) {
      await expect(logo).toHaveAttribute('alt', /logo$/)
      await expect.poll(() => logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
    }
  })

  test('a university whose cost is unknown says so instead of showing a wrong number', async ({ page, backend }) => {
    backend.tables.university_costs = backend.tables.university_costs.filter((c) => c.university_id !== 2)
    await openUniversities(page)
    await expect(card(page, 'Boston University')).toContainText('Not available')
  })

  test('Details opens that university', async ({ page }) => {
    await openUniversities(page)
    await page.getByTestId('filter-search-input').fill('zurich')
    await card(page, 'University of Zurich').getByTestId('university-card-link').click()
    await expect(page).toHaveURL(/\/universities\/8$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('University of Zurich')
  })

  test('shows a loading message while the universities arrive', async ({ page, backend }) => {
    backend.slow('/rest/v1/universities', 700)
    await page.goto('/universities')
    await expect(page.getByTestId('universities-loading')).toBeVisible()
    await expect(page.getByTestId('university-card').first()).toBeVisible()
    await expect(page.getByTestId('universities-loading')).toHaveCount(0)
  })

  test('shows an error, not an empty list, when the universities cannot be loaded', async ({ page, backend }) => {
    backend.fail('/rest/v1/universities', { status: 500, body: { code: 'XX000', message: 'database is down' } })
    await page.goto('/universities')
    await expect(page.getByTestId('universities-error')).toContainText('database is down')
    await expect(page.getByTestId('university-card')).toHaveCount(0)
    await expect(page.getByTestId('universities-empty')).toHaveCount(0)
  })

  test('still lists universities when the exchange rates are down, with an explanation', async ({ page, backend }) => {
    backend.fail(/frankfurter|\/v2\/rates/, { status: 503 })
    await page.goto('/universities')
    await expect(page.getByTestId('university-card').first()).toBeVisible()
    await expect(page.getByTestId('exchange-rates-error')).toBeVisible()
    await expect(card(page, 'Boston University')).toContainText('SGD estimate unavailable')
  })
})

test.describe('searching', () => {
  test.beforeEach(async ({ page }) => {
    await openUniversities(page)
  })

  test('finds a university by part of its name, ignoring capitals', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill('KYOTO')
    expect(await names(page)).toEqual(['Kyoto University'])
  })

  test('finds universities by country', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill('united kingdom')
    expect(await names(page)).toEqual(["King's College London", 'University College London'])
  })

  test('finds universities by city', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill('london')
    expect(await names(page)).toEqual(["King's College London", 'University College London'])
  })

  test('copes with an apostrophe in a name', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill("king's")
    expect(await names(page)).toEqual(["King's College London"])
  })

  test('spaces around the search are ignored, and only spaces shows everything', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill('   zurich  ')
    expect(await names(page)).toEqual(['University of Zurich'])
    await page.getByTestId('filter-search-input').fill('     ')
    await expect(page.getByTestId('university-card')).toHaveCount(PAGE_SIZE)
  })

  test('characters with a special meaning in patterns do not break the search', async ({ page }) => {
    for (const text of ['(', '[a-z', '.*', '\\', '<script>alert(1)</script>']) {
      await page.getByTestId('filter-search-input').fill(text)
      await expect(page.getByTestId('universities-empty')).toBeVisible()
    }
  })

  test('says so when nothing matches, and recovers when the search is cleared', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill('zzzzzz')
    await expect(page.getByTestId('universities-empty')).toHaveText('No partner universities match your search.')
    await expect(page.getByText(`Showing 0 of ${allNames.length} partner universities`)).toBeVisible()
    await page.getByTestId('filter-search-input').fill('')
    await expect(page.getByTestId('university-card')).toHaveCount(PAGE_SIZE)
  })

  test('the count follows the search', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill('australia')
    await expect(page.getByText(`Showing 2 of ${allNames.length} partner universities`)).toBeVisible()
  })

  test('a very long search does not break anything', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill('a'.repeat(5000))
    await expect(page.getByTestId('universities-empty')).toBeVisible()
  })
})

test.describe('filtering by region', () => {
  test.beforeEach(async ({ page }) => {
    await openUniversities(page)
  })

  test('offers every region that has a university, once each, in order', async ({ page }) => {
    const options = await texts(page.getByTestId('filter-region-select').locator('option'))
    const regions = [...new Set(VISIBLE_UNIVERSITIES.map((u) => u.region))].sort(byName)
    expect(options).toEqual(['All Regions', ...regions])
  })

  for (const region of ['Europe', 'Asia', 'Americas', 'Oceania', 'Africa', 'Middle-East']) {
    test(`${region} lists only ${region} universities`, async ({ page }) => {
      await page.getByTestId('filter-region-select').selectOption(region)
      const expected = VISIBLE_UNIVERSITIES.filter((u) => u.region === region).map((u) => u.name).sort(byName).slice(0, PAGE_SIZE)
      expect(await names(page)).toEqual(expected)
    })
  }

  test('can be combined with a search', async ({ page }) => {
    await page.getByTestId('filter-region-select').selectOption('Europe')
    await page.getByTestId('filter-search-input').fill('london')
    expect(await names(page)).toEqual(["King's College London", 'University College London'])
    await page.getByTestId('filter-search-input').fill('kyoto')
    await expect(page.getByTestId('universities-empty')).toBeVisible()
  })

  test('the reset button only appears once something is filtered, and clears everything', async ({ page }) => {
    await expect(page.getByTestId('clear-filters-btn')).toHaveCount(0)
    await page.getByTestId('filter-region-select').selectOption('Asia')
    await page.getByTestId('filter-search-input').fill('ko')
    await page.getByTestId('filter-sort-select').selectOption('country')
    await page.getByTestId('clear-filters-btn').click()
    await expect(page.getByTestId('filter-region-select').locator('option:checked')).toHaveText('All Regions')
    await expect(page.getByTestId('filter-search-input')).toHaveValue('')
    await expect(page.getByTestId('filter-sort-select')).toHaveValue('name')
    await expect(page.getByTestId('clear-filters-btn')).toHaveCount(0)
    expect(await names(page)).toEqual(allNames.slice(0, PAGE_SIZE))
  })
})

test.describe('sorting', () => {
  test.beforeEach(async ({ page }) => {
    await openUniversities(page)
  })

  test('by country, and by name within the same country', async ({ page }) => {
    await page.getByTestId('filter-sort-select').selectOption('country')
    const expected = [...VISIBLE_UNIVERSITIES]
      .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))
      .map((u) => u.name)
      .slice(0, PAGE_SIZE)
    expect(await names(page)).toEqual(expected)
  })

  test('by monthly cost, cheapest first, comparing in SGD and not in local currency', async ({ page }) => {
    await page.getByTestId('filter-sort-select').selectOption('cost')
    const expected = [...VISIBLE_UNIVERSITIES].sort((a, b) => monthlyCostSgd(a.id) - monthlyCostSgd(b.id)).map((u) => u.name).slice(0, PAGE_SIZE)
    expect(await names(page)).toEqual(expected)
    // Yonsei's bill is in the hundreds of thousands (won), which would sort it last if currencies were ignored
    const cheapest = expected.indexOf('Yonsei University')
    expect(cheapest).toBeGreaterThanOrEqual(0)
  })

  test('a university with no known cost goes to the end of a cost sort', async ({ page, backend }) => {
    backend.tables.university_costs = backend.tables.university_costs.filter((c) => c.university_id !== 4)
    await page.reload()
    await expect(page.getByTestId('university-card').first()).toBeVisible()
    await page.getByTestId('filter-sort-select').selectOption('cost')
    await page.getByRole('button', { name: 'Page 3' }).click()
    expect((await names(page)).at(-1)).toBe('Yonsei University')
  })

  test('sorting keeps the filter, and a changed sort returns to the first page', async ({ page }) => {
    await page.getByRole('button', { name: 'Page 2' }).click()
    await page.getByTestId('filter-sort-select').selectOption('country')
    await expect(page.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('pages', () => {
  test.beforeEach(async ({ page }) => {
    await openUniversities(page)
  })

  test('splits the list into pages of six', async ({ page }) => {
    const pagination = page.getByTestId('universities-pagination')
    await expect(pagination.getByRole('button', { name: /^Page \d+$/ })).toHaveCount(Math.ceil(allNames.length / PAGE_SIZE))
    await pagination.getByRole('button', { name: 'Page 3' }).click()
    expect(await names(page)).toEqual(allNames.slice(12))
  })

  test('Previous is unavailable on the first page and Next on the last', async ({ page }) => {
    const pagination = page.getByTestId('universities-pagination')
    await expect(pagination.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await pagination.getByRole('button', { name: 'Page 3' }).click()
    await expect(pagination.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await expect(pagination.getByRole('button', { name: 'Previous page' })).toBeEnabled()
  })

  test('Next and Previous walk through the pages', async ({ page }) => {
    const pagination = page.getByTestId('universities-pagination')
    await pagination.getByRole('button', { name: 'Next page' }).click()
    expect(await names(page)).toEqual(allNames.slice(6, 12))
    await expect(pagination.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
    await pagination.getByRole('button', { name: 'Previous page' }).click()
    expect(await names(page)).toEqual(allNames.slice(0, 6))
  })

  test('a new search starts again from the first page', async ({ page }) => {
    await page.getByRole('button', { name: 'Page 3' }).click()
    await page.getByTestId('filter-search-input').fill('university')
    await expect(page.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
  })

  test('there are no page buttons when everything fits on one page', async ({ page }) => {
    await page.getByTestId('filter-search-input').fill('london')
    await expect(page.getByTestId('universities-pagination')).toHaveCount(0)
  })
})

test.describe('shortlisting from the list', () => {
  test('a visitor who tries is sent to log in and comes back to the list', async ({ page, student }) => {
    await openUniversities(page)
    await card(page, 'Boston University').getByTestId('shortlist-add-btn').click()
    await expect(page.getByTestId('login-page')).toBeVisible()
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/universities')
    await page.getByTestId('login-email-input').fill(student.email)
    await page.getByTestId('login-password-input').fill(student.password)
    await page.getByTestId('login-submit-btn').click()
    await expect(page.getByTestId('university-card').first()).toBeVisible()
  })

  test('a student can add and remove, and the button follows', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openUniversities(page)
    const boston = card(page, 'Boston University')
    await boston.getByTestId('shortlist-add-btn').click()
    await expect(boston.getByTestId('shortlist-remove-btn')).toHaveText('Remove From Shortlist')
    expect(backend.rows('shortlists')).toMatchObject([{ user_id: student.id, university_id: 2 }])
    await boston.getByTestId('shortlist-remove-btn').click()
    await expect(boston.getByTestId('shortlist-add-btn')).toBeVisible()
    expect(backend.rows('shortlists')).toHaveLength(0)
  })

  test('the shortlist is remembered after a reload', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openUniversities(page)
    await card(page, 'Kyoto University').getByTestId('shortlist-add-btn').click()
    await expect(card(page, 'Kyoto University').getByTestId('shortlist-remove-btn')).toBeVisible()
    await page.reload()
    await expect(card(page, 'Kyoto University').getByTestId('shortlist-remove-btn')).toBeVisible()
  })

  test('each student sees only their own shortlist', async ({ page, student, backend, person }) => {
    await signIn(page, student, backend)
    await openUniversities(page)
    await card(page, 'Boston University').getByTestId('shortlist-add-btn').click()
    await expect(card(page, 'Boston University').getByTestId('shortlist-remove-btn')).toBeVisible()

    const other = await person(backend.createUser())
    await openUniversities(other)
    await expect(card(other, 'Boston University').getByTestId('shortlist-add-btn')).toBeVisible()
  })

  test('double clicking adds it once', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openUniversities(page)
    backend.slow({ method: 'POST', path: '/rest/v1/shortlists' }, 300)
    await card(page, 'Boston University').getByTestId('shortlist-add-btn').dblclick()
    await expect(card(page, 'Boston University').getByTestId('shortlist-remove-btn')).toBeVisible()
    await idle(page)
    expect(backend.rows('shortlists')).toHaveLength(1)
  })

  test('a failed save shows an error and leaves the button as it was', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openUniversities(page)
    backend.fail({ method: 'POST', path: '/rest/v1/shortlists' }, { status: 500, body: { code: 'XX000', message: 'could not save' } })
    await card(page, 'Boston University').getByTestId('shortlist-add-btn').click()
    await expect(page.getByTestId('shortlist-error')).toContainText('could not save')
    await expect(card(page, 'Boston University').getByTestId('shortlist-add-btn')).toBeVisible()
    expect(backend.rows('shortlists')).toHaveLength(0)
  })

  test.fixme('adding straight away, before the existing shortlist has loaded, keeps the new entry', async ({ page, student, backend }) => {
    // Known gap: the shortlist is fetched after the universities. If a student clicks Add in
    // that gap, the late response replaces the list and the button flips back to "Add".
    await signIn(page, student, backend)
    backend.slow({ method: 'GET', path: '/rest/v1/shortlists' }, 800)
    await page.goto('/universities')
    await card(page, 'Boston University').getByTestId('shortlist-add-btn').click()
    await idle(page)
    await expect(card(page, 'Boston University').getByTestId('shortlist-remove-btn')).toBeVisible()
  })
})
