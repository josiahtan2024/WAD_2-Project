import { test, expect } from './support/fixtures.js'
import { idle, openUniversity, texts } from './support/ui.js'
import { distanceFromSmu, monthlyCostSgd, universityNamed } from './support/seed.js'

const money = (amount, currency) => new Intl.NumberFormat('en-SG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount).replace(/\s/g, ' ')
const section = (page, heading) => page.locator('section.card').filter({ has: page.getByRole('heading', { name: heading, exact: true }) })
const row = (box, label) => box.locator('dl > div').filter({ has: box.page().getByText(label, { exact: true }) })

test.describe('the page for one university', () => {
  test('shows the name, place, logo and a link to the university website', async ({ page }) => {
    await openUniversity(page, 'University of Zurich')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('University of Zurich')
    await expect(page.getByTestId('university-page')).toContainText('Zurich, Switzerland')
    const logo = page.getByAltText('University of Zurich logo')
    await expect(logo).toBeVisible()
    await expect.poll(() => logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
    const website = page.getByRole('link', { name: 'Visit Website' })
    await expect(website).toHaveAttribute('href', universityNamed('University of Zurich').website_url)
    await expect(website).toHaveAttribute('target', '_blank')
    await expect(website).toHaveAttribute('rel', /noopener/)
    await expect(page).toHaveTitle('University Details | SMUXchange')
  })

  test('the Location card lists the place, timezone and distance from SMU', async ({ page }) => {
    await openUniversity(page, 'Kyoto University')
    const location = section(page, 'Location')
    const kyoto = universityNamed('Kyoto University')
    for (const [label, value] of [['City', 'Kyoto'], ['State / province', 'Kyoto'], ['Country', 'Japan'], ['Region', 'Asia'], ['Timezone', 'UTC+9'], ['Distance from SMU', `${distanceFromSmu(kyoto.lat, kyoto.long)} km`]]) {
      await expect(row(location, label)).toContainText(value)
    }
    await expect(location.getByRole('link', { name: 'Open Map' })).toBeVisible()
  })

  test('the Cost card shows each cost in the local currency and the total in SGD', async ({ page }) => {
    await openUniversity(page, 'Boston University')
    const cost = section(page, 'Cost')
    await expect(page.getByTestId('university-cost-accommodation')).toContainText(money(1800, 'USD'))
    await expect(page.getByTestId('university-cost-food')).toContainText(money(800, 'USD'))
    await expect(page.getByTestId('university-cost-transport')).toContainText(money(150, 'USD'))
    await expect(page.getByTestId('university-cost-personal')).toContainText(money(500, 'USD'))
    await expect(cost).toContainText(money(1800 + 800 + 150 + 500, 'USD'))
    await expect(page.getByTestId('university-monthly-total-sgd')).toContainText(money(monthlyCostSgd(2), 'SGD'))
  })

  test('a currency with no decimals is shown plainly', async ({ page }) => {
    await openUniversity(page, 'Yonsei University')
    await expect(page.getByTestId('university-cost-accommodation')).toContainText(money(800000, 'KRW'))
  })

  test('the Academics card counts modules and programmes and lists the languages', async ({ page }) => {
    await openUniversity(page, 'Yonsei University')
    const academics = section(page, 'Academics')
    await expect(row(academics, 'Instruction language')).toContainText('Korean, English')
    await expect(row(academics, 'Mapped modules')).toContainText('4')
    await expect(row(academics, 'Exchange programmes')).toContainText('2')
    await expect(academics.getByRole('link', { name: 'View course catalogue' })).toHaveAttribute('href', universityNamed('Yonsei University').modules_url)
  })

  test('the Exchange card starts on the first programme and switches between them', async ({ page }) => {
    await openUniversity(page, 'University College London')
    const exchange = section(page, 'Exchange')
    const periods = exchange.getByRole('group', { name: 'Exchange periods' }).getByRole('button')
    expect(await texts(periods)).toEqual(['Sep 2026', 'Jan 2027'])
    await expect(periods.first()).toHaveAttribute('aria-pressed', 'true')
    await expect(row(exchange, 'Programme')).toContainText('Fall 2026')
    await expect(row(exchange, 'Exchange period')).toContainText('Sep 2026 to Dec 2026')
    await expect(row(exchange, 'Temperature')).toContainText('2 – 22 °C')

    await periods.nth(1).click()
    await expect(periods.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(periods.first()).toHaveAttribute('aria-pressed', 'false')
    await expect(row(exchange, 'Programme')).toContainText('Spring 2027')
    await expect(row(exchange, 'Term')).toContainText('2')
    await expect(row(exchange, 'Academic year')).toContainText('2026/2027')
    await expect(row(exchange, 'Exchange period')).toContainText('Jan 2027 to May 2027')
    await expect(row(exchange, 'Temperature')).toContainText('-3 – 18 °C')
    await expect(row(exchange, 'Overview')).toContainText('Cold to mild')
  })

  test('says "not available" for anything that has not been filled in yet', async ({ page, backend }) => {
    backend.tables.university_costs = backend.tables.university_costs.filter((c) => c.university_id !== 5)
    backend.tables.exchange_periods = backend.tables.exchange_periods.filter((p) => p.university_id !== 5)
    backend.tables.university_languages = backend.tables.university_languages.filter((l) => l.university_id !== 5)
    Object.assign(backend.rows('universities').find((u) => u.id === 5), { timezone: null, state: null, website_url: null, modules_url: null })
    await openUniversity(page, 'Kyoto University')
    await expect(section(page, 'Cost')).toContainText('Cost information is not available.')
    await expect(section(page, 'Exchange')).toContainText('Exchange period information is not available.')
    await expect(row(section(page, 'Academics'), 'Instruction language')).toContainText('Not available')
    await expect(row(section(page, 'Location'), 'Timezone')).toContainText('Not available')
    await expect(row(section(page, 'Location'), 'State / province')).toContainText('Not available')
    await expect(page.getByRole('link', { name: 'Visit Website' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'View course catalogue' })).toHaveCount(0)
  })

  test('there is no map link when the university has no coordinates', async ({ page, backend }) => {
    Object.assign(backend.rows('universities').find((u) => u.id === 5), { lat: null, long: null })
    await openUniversity(page, 'Kyoto University')
    await expect(page.getByRole('link', { name: 'Open Map' })).toHaveCount(0)
    await expect(row(section(page, 'Location'), 'Distance from SMU')).toContainText('Not available')
  })

  test('Open Map goes to the map with this university selected', async ({ page }) => {
    await openUniversity(page, 'Kyoto University')
    await page.getByRole('link', { name: 'Open Map' }).click()
    await expect(page.getByTestId('home-page')).toBeVisible()
    expect(new URL(page.url()).searchParams.get('university')).toBe('5')
  })
})

test.describe('addresses that do not lead to a university', () => {
  for (const id of ['9999', '0', 'abc', '-1', "1'%20or%20'1'='1"]) {
    test(`/universities/${id} says the university was not found`, async ({ page }) => {
      await page.goto(`/universities/${id}`)
      await expect(page.getByTestId('university-not-found')).toContainText('University not found')
      await page.getByRole('link', { name: 'Back to list' }).click()
      await expect(page).toHaveURL(/\/universities$/)
    })
  }
})

test.describe('while loading and when things go wrong', () => {
  test('shows a loading message until the university is ready', async ({ page, backend }) => {
    backend.slow('/rest/v1/universities', 600)
    await page.goto('/universities/2')
    await expect(page.getByTestId('university-loading')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Boston University')
  })

  test('shows an error when the university cannot be loaded at all', async ({ page, backend }) => {
    backend.fail({ method: 'GET', path: '/rest/v1/universities?select=*' }, { status: 500, body: { code: 'XX000', message: 'database is down' } })
    await page.goto('/universities/2')
    await expect(page.getByTestId('university-error')).toContainText('database is down')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0)
  })

  test('still shows the page when only the extra details fail, and says what is missing', async ({ page, backend }) => {
    backend.fail({ method: 'GET', path: 'select=university_languages' }, { status: 500, body: { code: 'XX000', message: 'details are unavailable' } })
    await page.goto('/universities/2')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Boston University')
    await expect(page.getByRole('status').filter({ hasText: 'details are unavailable' })).toBeVisible()
    await expect(page.getByTestId('university-cost-food')).toBeVisible()
  })

  test('says so when the course mappings cannot be loaded', async ({ page, backend }) => {
    backend.fail('/rest/v1/credit_mappings', { status: 500, body: { code: 'XX000', message: 'mappings are unavailable' } })
    await page.goto('/universities/2')
    await expect(page.getByRole('status').filter({ hasText: 'mappings are unavailable' })).toBeVisible()
    await expect(page.getByTestId('credit-mapping-table')).toHaveCount(0)
  })
})

test.describe('the course mapping list', () => {
  const open = async (page, name = 'Boston University') => {
    await openUniversity(page, name)
    await idle(page)
    const table = page.getByTestId('credit-mapping-table')
    await table.getByRole('heading', { name: 'Course Mapping' }).click()
    return table
  }

  test('is collapsed to begin with and shows how many courses are mapped', async ({ page }) => {
    await openUniversity(page, 'Boston University')
    const table = page.getByTestId('credit-mapping-table')
    await expect(table).not.toHaveAttribute('open', '')
    await expect(table.locator('summary').first()).toContainText('12 courses')
  })

  test('groups the partner courses under the SMU course area they count towards', async ({ page }) => {
    const table = await open(page)
    await expect(table.getByTestId('mapping-count')).toHaveText('12 of 12 mapped courses')
    await expect(table.getByTestId('mapping-group')).toHaveCount(6)
    const economics = table.getByTestId('mapping-group').filter({ hasText: 'XECO900' })
    await expect(economics).toContainText('School of Economics')
    await expect(economics).toContainText('3 courses')
    await expect(economics.getByTestId('mapping-row')).toHaveCount(3)
    await expect(economics).toContainText('CAS EC 403')
    await expect(economics).toContainText('Game Theory')
  })

  test('shows each course with its code, name and teaching language', async ({ page }) => {
    const table = await open(page, 'Yonsei University')
    await table.getByTestId('mapping-group').filter({ hasText: 'XFE902' }).locator('summary').click()
    const korean = table.getByTestId('mapping-row').filter({ hasText: 'KOR1103' })
    await expect(korean).toContainText('Basic Korean I')
    await expect(korean).toContainText('Language: Korean')
  })

  test('search narrows the list by course name, code or SMU course area', async ({ page }) => {
    const table = await open(page)
    await table.getByTestId('mapping-search').fill('derivatives')
    await expect(table.getByTestId('mapping-count')).toHaveText('1 of 12 mapped courses')
    await table.getByTestId('mapping-search').fill('QST MK')
    await expect(table.getByTestId('mapping-count')).toHaveText('2 of 12 mapped courses')
    await table.getByTestId('mapping-search').fill('xism927')
    await expect(table.getByTestId('mapping-count')).toHaveText('2 of 12 mapped courses')
  })

  test('says so when nothing matches, and the reset button brings everything back', async ({ page }) => {
    const table = await open(page)
    await table.getByTestId('mapping-search').fill('zzzzzz')
    await expect(table.getByTestId('mapping-no-results')).toBeVisible()
    await table.getByTestId('mapping-clear-filters').click()
    await expect(table.getByTestId('mapping-search')).toHaveValue('')
    await expect(table.getByTestId('mapping-count')).toHaveText('12 of 12 mapped courses')
  })

  test('the course area filter shows only that area', async ({ page }) => {
    const table = await open(page)
    const options = await texts(table.getByTestId('mapping-area-filter').locator('option'))
    expect(options[0]).toBe('All Course Areas')
    expect(options).toHaveLength(7)
    await table.getByTestId('mapping-area-filter').selectOption({ label: 'XBBM906' })
    await expect(table.getByTestId('mapping-group')).toHaveCount(1)
    await expect(table.getByTestId('mapping-row')).toHaveCount(2)
  })

  test('says so when the university has no mapped courses', async ({ page }) => {
    await openUniversity(page, 'Koc University')
    const table = page.getByTestId('credit-mapping-table')
    await table.getByRole('heading', { name: 'Course Mapping' }).click()
    await expect(table.getByTestId('mapping-empty')).toHaveText('No course mappings recorded for this university yet.')
    await expect(table.locator('summary').first()).toContainText('0 courses')
  })

  test('the badge counts courses correctly', async ({ page }) => {
    await openUniversity(page, 'University of Pretoria')
    await expect(page.getByTestId('credit-mapping-table').locator('summary').first()).toContainText('4 courses')
  })
})
