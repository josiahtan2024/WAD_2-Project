import { test, expect } from './support/fixtures.js'
import { idle, signIn } from './support/ui.js'
import { RATES } from './support/seed.js'

// Boston University publishes USD 1,800 housing + 800 food + 150 transport + 500 personal = 3,250 a month.
const BOSTON = { id: 2, name: 'Boston University', monthly: 3250, rate: RATES.USD }

const rows = (page) => page.getByTestId('budget-row')
const field = (page, name) => page.getByTestId(`budget-${name}-input`)
const submit = (page) => page.getByTestId('budget-submit-button')
const total = (page) => page.getByTestId('budget-total')
const notice = (page) => page.getByTestId('notice-success-message')

async function openBudgets(page) {
  await page.goto('/cost-estimator')
  await expect(page.getByTestId('budget-heading')).toBeVisible()
  await idle(page)
}

async function startNew(page) {
  await page.getByTestId('budget-create-button').first().click()
  await expect(page.getByTestId('budget-university-select')).toBeVisible()
}

async function chooseUniversity(page, name) {
  const select = page.getByTestId('budget-university-select')
  const value = await select.locator('option', { hasText: name }).first().getAttribute('value')
  await select.selectOption(value)
  await idle(page)
}

async function fillAmounts(page, { accommodation = 0, food = 0, transport = 0, personal = 0, other = 0 } = {}) {
  await field(page, 'accommodation').fill(String(accommodation))
  await field(page, 'food').fill(String(food))
  await field(page, 'transport').fill(String(transport))
  await field(page, 'personal').fill(String(personal))
  await field(page, 'other').fill(String(other))
}

/** Saved budgets for one student, straight from the backend. */
const saved = (backend, user) => backend.rows('user_budgets').filter((b) => b.user_id === user.id)

test.describe('budget planner: access', () => {
  test('asks a logged-out visitor to log in first', async ({ page }) => {
    await page.goto('/cost-estimator')
    await expect(page).toHaveURL(/\/login/)
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/cost-estimator')
  })

  test('returns to the planner after logging in', async ({ page, student }) => {
    await page.goto('/cost-estimator')
    await page.getByTestId('login-email-input').fill(student.email)
    await page.getByTestId('login-password-input').fill(student.password)
    await page.getByTestId('login-submit-btn').click()
    await expect(page).toHaveURL(/\/cost-estimator$/)
    await expect(page.getByTestId('budget-heading')).toBeVisible()
  })
})

test.describe('budget planner: your budgets', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
  })

  test('starts with an invitation to create the first budget', async ({ page }) => {
    await openBudgets(page)
    await expect(page.getByTestId('budget-empty-state')).toHaveText('No Budgets Yet')
    await page.getByRole('button', { name: 'Create Your First Budget' }).click()
    await expect(page.getByTestId('budget-university-select')).toBeVisible()
  })

  test('lists saved budgets, newest first, with period, duration and total', async ({ page, student, backend }) => {
    backend.rows('user_budgets').push(
      { id: 1, user_id: student.id, university_id: 2, exchange_period_id: 3, duration_months: 4, currency_code: 'USD', total_budget: 13000, accommodation_budget: 1800, food_budget: 800, transport_budget: 150, personal_budget: 500, other_budget: 0 },
      { id: 2, user_id: student.id, university_id: 5, exchange_period_id: null, duration_months: 6, currency_code: 'JPY', total_budget: 900000, accommodation_budget: 90000, food_budget: 40000, transport_budget: 10000, personal_budget: 10000, other_budget: 0 },
    )
    await openBudgets(page)
    await expect(rows(page)).toHaveCount(2)
    await expect(rows(page).first()).toContainText('Kyoto University')
    await expect(rows(page).first()).toContainText('Not specified')
    await expect(rows(page).first()).toContainText('6 months')
    await expect(rows(page).nth(1)).toContainText('Boston University')
    await expect(rows(page).nth(1)).toContainText('Fall 2026')
    await expect(rows(page).nth(1)).toContainText('4 months')
    await expect(rows(page).nth(1)).toContainText('$13,000.00')
  })

  test('only shows this student\'s budgets', async ({ page, student, backend }) => {
    const other = backend.createUser()
    backend.rows('user_budgets').push(
      { id: 1, user_id: other.id, university_id: 2, duration_months: 4, currency_code: 'USD', total_budget: 1, accommodation_budget: 1, food_budget: 0, transport_budget: 0, personal_budget: 0, other_budget: 0 },
      { id: 2, user_id: student.id, university_id: 5, duration_months: 4, currency_code: 'JPY', total_budget: 1, accommodation_budget: 1, food_budget: 0, transport_budget: 0, personal_budget: 0, other_budget: 0 },
    )
    await openBudgets(page)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page)).toContainText('Kyoto University')
  })

  test.describe('with several budgets', () => {
    test.beforeEach(async ({ student, backend }) => {
      const make = (id, university_id, total_budget) => ({ id, user_id: student.id, university_id, exchange_period_id: null, duration_months: 4, currency_code: 'SGD', total_budget, accommodation_budget: 1, food_budget: 0, transport_budget: 0, personal_budget: 0, other_budget: 0 })
      backend.rows('user_budgets').push(make(1, 2, 5000), make(2, 5, 1000), make(3, 7, 3000), make(4, 1, 2000))
    })

    test('searches by university, country, region', async ({ page }) => {
      await openBudgets(page)
      await page.getByLabel('Search Budgets').fill('japan')
      await expect(rows(page)).toHaveCount(1)
      await page.getByLabel('Search Budgets').fill('europe')
      await expect(rows(page)).toHaveCount(1)
      await expect(rows(page)).toContainText('University College London')
      await page.getByLabel('Search Budgets').fill('nowhere')
      await expect(page.getByText('No Matching Budgets')).toBeVisible()
      await page.getByRole('button', { name: 'Clear Filters' }).click()
      await expect(rows(page)).toHaveCount(4)
    })

    test('filters by region', async ({ page }) => {
      await openBudgets(page)
      await page.getByLabel('Filter by Region').selectOption('Asia')
      await expect(rows(page)).toHaveCount(1)
      await expect(rows(page)).toContainText('Kyoto University')
    })

    test('sorts by name, country and cost', async ({ page }) => {
      await openBudgets(page)
      const names = () => rows(page).locator('.fw-semibold').filter({ hasText: /University/ }).allInnerTexts()
      await page.getByLabel('Sort By').selectOption('name')
      expect((await names()).slice(0, 2)).toEqual(['Boston University', 'Kyoto University'])
      await page.getByLabel('Sort By').selectOption('cost')
      expect((await names())[0]).toBe('Kyoto University')
      await page.getByLabel('Sort By').selectOption('country')
      expect((await names())[0]).toBe('Kyoto University') // Japan
    })

    test('does not list budgets for universities that have since been hidden', async ({ page, backend }) => {
      backend.find('universities', (u) => u.id === 5).published = false
      await openBudgets(page)
      await expect(rows(page)).toHaveCount(3)
      await expect(rows(page).filter({ hasText: 'Kyoto University' })).toHaveCount(0)
    })
  })

  test('pages through more than six budgets', async ({ page, student, backend }) => {
    for (let id = 1; id <= 8; id++) {
      backend.rows('user_budgets').push({ id, user_id: student.id, university_id: id, exchange_period_id: null, duration_months: 4, currency_code: 'SGD', total_budget: id, accommodation_budget: 1, food_budget: 0, transport_budget: 0, personal_budget: 0, other_budget: 0 })
    }
    await openBudgets(page)
    await expect(rows(page)).toHaveCount(6)
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(rows(page)).toHaveCount(2)
    await page.getByRole('button', { name: 'Previous page' }).click()
    await expect(rows(page)).toHaveCount(6)
  })
})

test.describe('budget planner: creating a budget', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openBudgets(page)
    await startNew(page)
  })

  test('starts with nothing chosen and the button disabled', async ({ page }) => {
    await expect(page.getByTestId('budget-university-select')).toHaveValue('')
    await expect(submit(page)).toBeDisabled()
    await expect(total(page)).toContainText('0.00')
  })

  test('lists only visible universities, with their country', async ({ page }) => {
    const options = await page.getByTestId('budget-university-select').locator('option').allInnerTexts()
    expect(options).toContain('Boston University — United States')
    expect(options.join()).not.toContain('Atlantis')
  })

  test('adding up the amounts gives a monthly and an overall total', async ({ page }) => {
    await chooseUniversity(page, BOSTON.name)
    await field(page, 'duration').fill('5')
    await fillAmounts(page, { accommodation: 1000, food: 500, transport: 100, personal: 200, other: 50 })
    await expect(total(page)).toHaveText('US$9,250.00')
    await expect(page.getByText('Monthly Budget').locator('xpath=..')).toContainText('$1,850.00')
  })

  test('shows the equivalent in SGD using the current rate', async ({ page }) => {
    await chooseUniversity(page, BOSTON.name)
    await field(page, 'duration').fill('1')
    await fillAmounts(page, { accommodation: 780 })
    await expect(page.getByText('Estimated in SGD').locator('xpath=..')).toContainText(`$${(780 / BOSTON.rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
  })

  test('copies the published estimates in', async ({ page }) => {
    await chooseUniversity(page, BOSTON.name)
    await page.getByRole('button', { name: 'Use Published Estimates' }).click()
    await expect(field(page, 'accommodation')).toHaveValue('1800')
    await expect(field(page, 'food')).toHaveValue('800')
    await expect(field(page, 'transport')).toHaveValue('150')
    await expect(field(page, 'personal')).toHaveValue('500')
    await expect(notice(page)).toContainText('Published estimates copied into your budget')
  })

  test('preferences scale the published price', async ({ page }) => {
    await chooseUniversity(page, BOSTON.name)
    await page.getByLabel(/Accommodation Type|Housing/i).first().selectOption('dormitory')
    await expect(field(page, 'accommodation')).toHaveValue(String(1800 * 0.7))
    await page.getByLabel(/Food Preference/i).selectOption('restaurant')
    await expect(field(page, 'food')).toHaveValue(String(800 * 1.6))
    await page.getByLabel(/Transport/i).first().selectOption('walk')
    await expect(field(page, 'transport')).toHaveValue(String(150 * 0.2))
  })

  test('choosing an exchange period sets the duration from its dates', async ({ page }) => {
    await chooseUniversity(page, BOSTON.name)
    await page.getByLabel(/Exchange Period/i).selectOption({ index: 1 })
    await expect(field(page, 'duration')).toHaveValue('4') // 2 Sep to 18 Dec
  })

  test('saves the budget for this student and returns to the list', async ({ page, student, backend }) => {
    await chooseUniversity(page, BOSTON.name)
    await page.getByLabel(/Exchange Period/i).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Use Published Estimates' }).click()
    await submit(page).click()
    await expect(notice(page)).toHaveText('Your new budget has been created successfully.')
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page)).toContainText('Boston University')
    await expect(rows(page)).toContainText('$13,000.00')
    const [row] = saved(backend, student)
    const fall = backend.find('exchange_periods', (p) => p.university_id === 2 && p.period_name === 'Fall 2026')
    expect(row).toMatchObject({ university_id: 2, exchange_period_id: fall.id, duration_months: 4, currency_code: 'USD', total_budget: 13000, accommodation_budget: 1800, food_budget: 800, transport_budget: 150, personal_budget: 500, other_budget: 0 })
  })

  test('remembers the chosen preferences', async ({ page, student, backend }) => {
    await chooseUniversity(page, BOSTON.name)
    await page.getByLabel(/Accommodation Type|Housing/i).first().selectOption('studio')
    await submit(page).click()
    await expect(notice(page)).toBeVisible()
    expect(saved(backend, student)[0].housing_type).toBe('studio')
  })

  test('refuses a second budget for the same university', async ({ page, student, backend }) => {
    backend.rows('user_budgets').push({ id: 1, user_id: student.id, university_id: 2, duration_months: 4, currency_code: 'USD', total_budget: 1, accommodation_budget: 1, food_budget: 0, transport_budget: 0, personal_budget: 0, other_budget: 0 })
    await chooseUniversity(page, BOSTON.name)
    await submit(page).click()
    await expect(page.getByRole('alert')).toBeVisible()
    expect(saved(backend, student)).toHaveLength(1)
  })

  test('does not save negative amounts', async ({ page, backend, student }) => {
    await chooseUniversity(page, BOSTON.name)
    await field(page, 'food').fill('-5')
    await expect(submit(page)).toBeDisabled()
    expect(saved(backend, student)).toHaveLength(0)
  })

  test('does not save a duration outside 1 to 12 months', async ({ page }) => {
    await chooseUniversity(page, BOSTON.name)
    await field(page, 'duration').fill('13')
    await expect(submit(page)).toBeDisabled()
    await field(page, 'duration').fill('0')
    await expect(submit(page)).toBeDisabled()
    await field(page, 'duration').fill('12')
    await expect(submit(page)).toBeEnabled()
  })

  test('going back discards the draft', async ({ page }) => {
    await chooseUniversity(page, BOSTON.name)
    await page.getByRole('button', { name: /Back to My Budgets/ }).click()
    await expect(page.getByTestId('budget-heading')).toBeVisible()
    await startNew(page)
    await expect(page.getByTestId('budget-university-select')).toHaveValue('')
  })

  test('switching university clears what was typed for the previous one', async ({ page }) => {
    await chooseUniversity(page, BOSTON.name)
    await fillAmounts(page, { accommodation: 999 })
    await chooseUniversity(page, 'Kyoto University')
    await expect(field(page, 'accommodation')).toHaveValue('0')
  })

  test('shows the error when the save fails and keeps the form', async ({ page, backend, student }) => {
    await chooseUniversity(page, BOSTON.name)
    backend.fail('/rest/v1/user_budgets', { status: 500, body: { message: 'database is down' }, times: 1 })
    await submit(page).click()
    await expect(page.getByRole('alert')).toContainText('database is down')
    await expect(page.getByTestId('budget-university-select')).toHaveValue('2')
    await submit(page).click()
    await expect(notice(page)).toBeVisible()
    expect(saved(backend, student)).toHaveLength(1)
  })

  test('warns when the exchange rate cannot be fetched but still works', async ({ page }) => {
    await page.context().route('**/api.frankfurter.dev/**', (route) => route.fulfill({ status: 503, body: 'down' }))
    await chooseUniversity(page, 'Kyoto University')
    await expect(page.getByRole('alert')).toContainText('Could not load the currency conversion rate')
    await expect(submit(page)).toBeEnabled()
  })
})

test.describe('budget planner: reading, editing and deleting', () => {
  let budget
  test.beforeEach(async ({ page, student, backend }) => {
    budget = { id: 1, user_id: student.id, university_id: 2, exchange_period_id: 3, duration_months: 4, currency_code: 'USD', total_budget: 13000, accommodation_budget: 1800, food_budget: 800, transport_budget: 150, personal_budget: 500, other_budget: 0, housing_type: 'dormitory', food_option: null, transport_option: null }
    backend.rows('user_budgets').push(budget)
    await signIn(page, student, backend)
    await openBudgets(page)
  })

  test('Read shows the breakdown and preferences', async ({ page }) => {
    await page.getByTestId('budget-read-button').click()
    const dialog = page.getByTestId('budget-details-dialog')
    await expect(dialog).toContainText('Boston University')
    await expect(dialog).toContainText('Fall 2026')
    await expect(dialog).toContainText('$13,000.00')
    await expect(dialog).toContainText('$1,800.00')
    await expect(dialog).toContainText(/Dormitory/i)
    await page.getByTestId('budget-details-close').click()
    await expect(dialog).toBeHidden()
  })

  test('Edit opens the form filled in', async ({ page }) => {
    await page.getByTestId('budget-edit-button').click()
    await expect(page.getByTestId('budget-university-select')).toHaveValue('2')
    await expect(field(page, 'accommodation')).toHaveValue('1800')
    await expect(field(page, 'duration')).toHaveValue('4')
    await expect(submit(page)).toHaveText('Update Budget')
  })

  test('editing updates the same budget rather than adding another', async ({ page, student, backend }) => {
    await page.getByTestId('budget-edit-button').click()
    await field(page, 'food').fill('1000')
    await submit(page).click()
    await expect(notice(page)).toHaveText('Your budget has been updated successfully.')
    await expect(rows(page)).toHaveCount(1)
    expect(saved(backend, student)).toHaveLength(1)
    expect(saved(backend, student)[0]).toMatchObject({ id: 1, food_budget: 1000, total_budget: 13000 + 200 * 4 })
  })

  test('Delete asks first, and Cancel keeps the budget', async ({ page, student, backend }) => {
    await page.getByTestId('budget-delete-button').click()
    await expect(page.getByTestId('delete-confirm-dialog')).toContainText('Boston University')
    await page.getByTestId('delete-confirm-cancel').click()
    await expect(page.getByTestId('delete-confirm-dialog')).toBeHidden()
    await expect(rows(page)).toHaveCount(1)
    expect(saved(backend, student)).toHaveLength(1)
  })

  test('confirming deletes it', async ({ page, student, backend }) => {
    await page.getByTestId('budget-delete-button').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(notice(page)).toHaveText('Budget deleted successfully.')
    await expect(page.getByTestId('budget-empty-state')).toBeVisible()
    expect(saved(backend, student)).toHaveLength(0)
  })

  test('a failed delete leaves the budget and says why', async ({ page, backend, student }) => {
    backend.fail('/rest/v1/user_budgets', { status: 500, body: { message: 'cannot delete right now' }, times: 1 })
    await page.getByTestId('budget-delete-button').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(page.getByRole('alert')).toContainText('cannot delete right now')
    await expect(rows(page)).toHaveCount(1)
    expect(saved(backend, student)).toHaveLength(1)
  })

  test('the success notice can be dismissed', async ({ page }) => {
    await page.getByTestId('budget-delete-button').click()
    await page.getByTestId('delete-confirm-action').click()
    await page.getByTestId('notice-dismiss-success').click()
    await expect(notice(page)).toBeHidden()
  })
})
