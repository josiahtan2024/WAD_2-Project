import { test, expect } from './support/fixtures.js'
import { idle, signIn, texts, openMenu, nav } from './support/ui.js'

const ATLANTIS = 15 // seeded, hidden, nothing filled in
const BOSTON = 2

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const drawer = (page) => page.getByTestId('admin-drawer')
const save = (page) => page.getByTestId('admin-drawer-save')
const fieldErrors = (page) => page.getByTestId('admin-field-error')
const notice = (page) => page.getByTestId('notice-success-message')
const universityNamed = (backend, name) => backend.find('universities', (u) => u.name === name)

async function openUniversity(page, id) {
  await page.goto(`/universities/${id}`)
  await expect(page.getByTestId('university-page')).toBeVisible()
  await idle(page)
}

async function openList(page) {
  await page.goto('/universities')
  await expect(page.getByTestId('universities-page')).toBeVisible()
  await idle(page)
}

async function addUniversity(page, { name, country = 'Testland', region = 'Europe', ...rest }) {
  await page.getByTestId('admin-add-university').click()
  await page.getByTestId('admin-field-name').fill(name)
  await page.getByTestId('admin-field-country').fill(country)
  await page.getByTestId('admin-field-region').selectOption(region)
  for (const [key, value] of Object.entries(rest)) {
    const field = page.getByTestId(`admin-field-${key}`)
    if (key === 'timezone') await field.selectOption(String(value))
    else await field.fill(String(value))
  }
  await save(page).click()
}

test.describe('admin: students see none of it', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
  })

  test('no staff controls on the list or a university page', async ({ page }) => {
    await openList(page)
    await expect(page.getByTestId('admin-add-university')).toHaveCount(0)
    await expect(page.getByTestId('admin-list-tools')).toHaveCount(0)
    await expect(page.getByTestId('university-card-edit')).toHaveCount(0)
    await openUniversity(page, BOSTON)
    await expect(page.getByTestId('admin-bar')).toHaveCount(0)
    await expect(page.getByTestId('admin-edit-cost')).toHaveCount(0)
    await expect(page.getByTestId('admin-edit-location')).toHaveCount(0)
    await expect(page.getByTestId('admin-edit-academics')).toHaveCount(0)
    await expect(page.getByTestId('admin-edit-exchange')).toHaveCount(0)
  })

  test('no staff badge or preview switch in the menu', async ({ page }) => {
    await page.goto('/')
    await openMenu(page)
    await expect(nav(page, 'nav-staff-badge')).toHaveCount(0)
    await expect(nav(page, 'nav-preview-toggle')).toHaveCount(0)
  })

  test('opening an edit link does nothing', async ({ page }) => {
    await page.goto(`/universities/${BOSTON}?edit=details`)
    await expect(page.getByTestId('university-page')).toBeVisible()
    await expect(drawer(page)).toHaveCount(0)
  })

  test('a hidden university is not found by a student, even with its link', async ({ page }) => {
    await page.goto(`/universities/${ATLANTIS}`)
    await expect(page.getByText('Atlantis Institute')).toHaveCount(0)
  })

  test('the database refuses a student\'s attempt to change a university', async ({ page, backend }) => {
    await openUniversity(page, BOSTON)
    const outcome = await page.evaluate(async ({ key, url, anon }) => {
      const session = JSON.parse(localStorage.getItem(key))
      const headers = { apikey: anon, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
      const edit = await fetch(`${url}/rest/v1/universities?id=eq.2`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'Hacked' }) })
      const add = await fetch(`${url}/rest/v1/universities`, { method: 'POST', headers, body: JSON.stringify({ name: 'Fake U', country: 'Nowhere', region: 'Europe' }) })
      const cost = await fetch(`${url}/rest/v1/university_costs?university_id=eq.2`, { method: 'PATCH', headers, body: JSON.stringify({ food: 1 }) })
      return { edit: await edit.json(), addStatus: add.status, cost: await cost.json() }
    }, { key: 'sb-mock-auth-token', url: 'https://mock.supabase.co', anon: 'mock-anon-key' })
    expect(outcome.edit).toEqual([])
    expect(outcome.addStatus).toBe(403)
    expect(outcome.cost).toEqual([])
    expect(universityNamed(backend, 'Boston University')).toBeTruthy()
    expect(universityNamed(backend, 'Fake U')).toBeUndefined()
  })

  test('a student cannot take the staff role by editing their own profile', async ({ page }) => {
    await page.goto('/')
    const outcome = await page.evaluate(async ({ key, url, anon }) => {
      const session = JSON.parse(localStorage.getItem(key))
      const response = await fetch(`${url}/auth/v1/user`, {
        method: 'PUT',
        headers: { apikey: anon, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { role: 'admin' } }),
      })
      return response.status
    }, { key: 'sb-mock-auth-token', url: 'https://mock.supabase.co', anon: 'mock-anon-key' })
    expect(outcome).toBeLessThan(500)
    await page.reload()
    await openMenu(page)
    await expect(nav(page, 'nav-staff-badge')).toHaveCount(0)
  })
})

test.describe('admin: the staff view', () => {
  test.beforeEach(async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
  })

  test('shows the staff badge and the controls', async ({ page }) => {
    await openUniversity(page, BOSTON)
    await expect(nav(page, 'nav-staff-badge').first()).toBeVisible()
    await expect(page.getByTestId('admin-bar')).toBeVisible()
    for (const part of ['cost', 'location', 'academics', 'exchange']) await expect(page.getByTestId(`admin-edit-${part}`)).toBeVisible()
  })

  test('previewing as a student hides the controls, and switching back restores them', async ({ page }) => {
    await openUniversity(page, BOSTON)
    await openMenu(page)
    await nav(page, 'nav-preview-toggle').click()
    await expect(page.getByTestId('admin-bar')).toHaveCount(0)
    await expect(page.getByTestId('admin-edit-cost')).toHaveCount(0)
    await expect(nav(page, 'nav-preview-badge').first()).toBeVisible()
    await openMenu(page)
    await expect(nav(page, 'nav-preview-toggle')).toHaveText('Exit Preview')
    await nav(page, 'nav-preview-toggle').click()
    await expect(page.getByTestId('admin-bar')).toBeVisible()
  })

  test('previewing hides unpublished universities from the list, like a student would see it', async ({ page }) => {
    await openList(page)
    await page.getByTestId('filter-search-input').fill('Atlantis')
    await expect(page.getByTestId('university-card-name').filter({ hasText: 'Atlantis Institute' })).toHaveCount(1)
    await openMenu(page)
    await nav(page, 'nav-preview-toggle').click()
    await expect(page.getByTestId('university-card-name').filter({ hasText: 'Atlantis Institute' })).toHaveCount(0)
  })

  test('the list marks hidden universities and can hide them from view', async ({ page }) => {
    await openList(page)
    await page.getByTestId('filter-search-input').fill('Atlantis')
    const card = page.getByTestId('university-card-name').filter({ hasText: 'Atlantis Institute' })
    await expect(card).toHaveCount(1)
    await expect(page.getByTestId('university-hidden-badge')).toHaveAttribute('title', 'Hidden from students')
    await page.getByTestId('admin-show-hidden').uncheck()
    await expect(card).toHaveCount(0)
    await page.getByTestId('admin-show-hidden').check()
    await expect(card).toHaveCount(1)
  })

  test('each card has an Edit link that opens the drawer', async ({ page }) => {
    await openList(page)
    await page.getByTestId('filter-search-input').fill('Kyoto')
    await page.getByTestId('university-card-edit').click()
    await expect(page).toHaveURL(/\/universities\/5$/)
    await expect(drawer(page)).toBeVisible()
    await expect(page.getByTestId('admin-field-name')).toHaveValue('Kyoto University')
  })

  test('an admin still has the student features', async ({ page, admin, backend }) => {
    await openList(page)
    await page.getByTestId('filter-search-input').fill('Boston')
    await page.getByTestId('shortlist-add-btn').click()
    await expect.poll(() => backend.rows('shortlists').filter((s) => s.user_id === admin.id).length).toBe(1)
  })
})

test.describe('admin: adding a university', () => {
  test.beforeEach(async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await openList(page)
  })

  test('creates it hidden and opens its page', async ({ page, backend }) => {
    await addUniversity(page, { name: 'Test University', country: 'Testland', region: 'Europe' })
    await expect(page).toHaveURL(/\/universities\/\d+$/)
    await expect(page.getByTestId('admin-hidden-banner')).toContainText('Hidden from students')
    await expect(page.getByTestId('admin-hidden-banner')).toContainText('Missing: a logo, a map location, costs, languages, exchange periods')
    expect(universityNamed(backend, 'Test University')).toMatchObject({ country: 'Testland', region: 'Europe', published: false })
  })

  test('asks for the name, country and region', async ({ page, backend }) => {
    await page.getByTestId('admin-add-university').click()
    await save(page).click()
    expect(await texts(fieldErrors(page))).toEqual(['Enter the university name.', 'Enter the country.', 'Select a region.'])
    expect(backend.writes('universities')).toHaveLength(0)
    await page.getByTestId('admin-drawer-cancel').click()
    await expect(drawer(page)).toHaveCount(0)
  })

  test('checks the coordinates', async ({ page }) => {
    await addUniversity(page, { name: 'Coords U', lat: '95', long: '10' })
    await expect(fieldErrors(page)).toContainText('Latitude must be between -90 and 90.')
    await page.getByTestId('admin-field-lat').fill('45')
    await page.getByTestId('admin-field-long').fill('')
    await save(page).click()
    await expect(fieldErrors(page)).toContainText('Enter both coordinates or leave both empty.')
    await page.getByTestId('admin-field-long').fill('190')
    await save(page).click()
    await expect(fieldErrors(page).first()).toContainText('Longitude must be between -180 and 180.')
  })

  test('saves the coordinates it was given', async ({ page, backend }) => {
    await addUniversity(page, { name: 'Pinned U', lat: '48.85', long: '2.35', city: 'Paris', timezone: '1' })
    await expect(page).toHaveURL(/\/universities\/\d+$/)
    expect(universityNamed(backend, 'Pinned U')).toMatchObject({ lat: 48.85, long: 2.35, city: 'Paris', timezone: 'UTC+1' })
  })

  test('refuses a duplicate name and country, however it is capitalised', async ({ page, backend }) => {
    await addUniversity(page, { name: 'boston UNIVERSITY', country: 'united states', region: 'Americas' })
    await expect(page.getByTestId('admin-drawer-error')).toHaveText('A university with that name and country already exists.')
    expect(backend.rows('universities').filter((u) => /boston/i.test(u.name))).toHaveLength(1)
  })

  test('allows the same name in another country', async ({ page, backend }) => {
    await addUniversity(page, { name: 'Boston University', country: 'Singapore', region: 'Asia' })
    await expect(page).toHaveURL(/\/universities\/\d+$/)
    expect(backend.rows('universities').filter((u) => u.name === 'Boston University')).toHaveLength(2)
  })

  test('offers only the six known regions', async ({ page }) => {
    await page.getByTestId('admin-add-university').click()
    const options = await page.getByTestId('admin-field-region').locator('option:not([disabled])').allInnerTexts()
    expect(options).toEqual(['Africa', 'Americas', 'Asia', 'Europe', 'Middle-East', 'Oceania'])
  })

  test('does not show up for students until it is published', async ({ page, person }) => {
    await addUniversity(page, { name: 'Invisible University' })
    await expect(page).toHaveURL(/\/universities\/\d+$/)
    const id = Number(page.url().split('/').pop())
    const visitor = await person()
    await visitor.goto('/universities')
    await visitor.getByTestId('filter-search-input').fill('Invisible')
    await expect(visitor.getByTestId('university-card-name')).toHaveCount(0)
    await visitor.goto(`/universities/${id}`)
    await expect(visitor.getByText('Invisible University')).toHaveCount(0)
  })

  test('shows the error when the server fails, and keeps the form', async ({ page, backend }) => {
    backend.fail('/rest/v1/universities', { status: 500, body: { message: 'database is down' }, times: 1 })
    await addUniversity(page, { name: 'Failing U' })
    await expect(page.getByTestId('admin-drawer-error')).toHaveText('database is down')
    await expect(page.getByTestId('admin-field-name')).toHaveValue('Failing U')
    await save(page).click()
    await expect(page).toHaveURL(/\/universities\/\d+$/)
  })

  test('a double click creates one university', async ({ page, backend }) => {
    backend.slow('/rest/v1/universities', 300)
    await page.getByTestId('admin-add-university').click()
    await page.getByTestId('admin-field-name').fill('Once Only U')
    await page.getByTestId('admin-field-country').fill('Testland')
    await page.getByTestId('admin-field-region').selectOption('Europe')
    await save(page).dblclick()
    await expect(page).toHaveURL(/\/universities\/\d+$/)
    expect(backend.rows('universities').filter((u) => u.name === 'Once Only U')).toHaveLength(1)
  })
})

test.describe('admin: editing a university', () => {
  test.beforeEach(async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await openUniversity(page, BOSTON)
  })

  test.describe('details', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByTestId('admin-edit-details').click()
    })

    test('opens filled in', async ({ page }) => {
      await expect(page.getByTestId('admin-field-name')).toHaveValue('Boston University')
      await expect(page.getByTestId('admin-field-website')).not.toHaveValue('')
    })

    test('saves the name, website and description', async ({ page, backend }) => {
      await page.getByTestId('admin-field-name').fill('Boston University (BU)')
      await page.getByTestId('admin-field-website').fill('https://www.bu.edu')
      await page.getByTestId('admin-field-description').fill('A private research university.')
      await save(page).click()
      await expect(notice(page)).toHaveText('Details saved.')
      await expect(drawer(page)).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Boston University (BU)')
      expect(backend.find('universities', (u) => u.id === BOSTON)).toMatchObject({ name: 'Boston University (BU)', website_url: 'https://www.bu.edu', description: 'A private research university.' })
    })

    test('needs a name and a proper web address', async ({ page, backend }) => {
      await page.getByTestId('admin-field-name').fill('  ')
      await page.getByTestId('admin-field-website').fill('www.bu.edu')
      await save(page).click()
      expect(await texts(fieldErrors(page))).toEqual(['Enter the university name.', 'Enter a valid URL (e.g. https://www.example.edu).'])
      expect(backend.writes('universities')).toHaveLength(0)
    })

    test('uploads a new logo', async ({ page, backend }) => {
      await page.getByTestId('admin-field-logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: TINY_PNG })
      await save(page).click()
      await expect(notice(page)).toHaveText('Details saved.')
      const logo = backend.find('universities', (u) => u.id === BOSTON).logo_url
      expect(logo).toMatch(/^university-logos\/boston-university-\d+\.png$/)
      expect(backend.files.has(logo)).toBe(true)
    })

    test('refuses a logo that is not an image or is too large', async ({ page, backend }) => {
      await page.getByTestId('admin-field-logo').setInputFiles({ name: 'logo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') })
      await save(page).click()
      await expect(page.getByTestId('admin-drawer-error')).toHaveText('The logo must be a JPG, PNG or WebP image.')
      await page.getByTestId('admin-field-logo').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
      await save(page).click()
      await expect(page.getByTestId('admin-drawer-error')).toHaveText('The logo must be 2 MB or smaller.')
      expect(backend.writes('universities')).toHaveLength(0)
    })

    test('does not leave the new logo behind if the save fails', async ({ page, backend }) => {
      const before = [...backend.files.keys()]
      backend.fail('/rest/v1/universities', { status: 500, body: { message: 'database is down' }, times: 1 })
      await page.getByTestId('admin-field-logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: TINY_PNG })
      await save(page).click()
      await expect(page.getByTestId('admin-drawer-error')).toHaveText('database is down')
      await idle(page)
      expect([...backend.files.keys()]).toEqual(before)
    })

    test('renaming into a clash is refused with a clear message', async ({ page }) => {
      await page.getByTestId('admin-field-name').fill('Kyoto University')
      await save(page).click()
      // different countries, so this is allowed; only an identical name + country clashes
      await expect(notice(page)).toHaveText('Details saved.')
    })

    test('Cancel and the close button leave the drawer without saving', async ({ page, backend }) => {
      await page.getByTestId('admin-field-name').fill('Changed my mind')
      await page.getByTestId('admin-drawer-cancel').click()
      await expect(drawer(page)).toHaveCount(0)
      await page.getByTestId('admin-edit-details').click()
      await expect(page.getByTestId('admin-field-name')).toHaveValue('Boston University')
      await page.getByTestId('admin-drawer-close').click()
      await expect(drawer(page)).toHaveCount(0)
      expect(backend.writes('universities')).toHaveLength(0)
    })

    test('Escape closes the drawer', async ({ page }) => {
      await page.keyboard.press('Escape')
      await expect(drawer(page)).toHaveCount(0)
    })
  })

  test.describe('location', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByTestId('admin-edit-location').click()
    })

    test('saves a new location', async ({ page, backend }) => {
      await page.getByTestId('admin-field-city').fill('Cambridge')
      await page.getByTestId('admin-field-lat').fill('42.37')
      await page.getByTestId('admin-field-long').fill('-71.11')
      await save(page).click()
      await expect(notice(page)).toHaveText('Location saved.')
      expect(backend.find('universities', (u) => u.id === BOSTON)).toMatchObject({ city: 'Cambridge', lat: 42.37, long: -71.11 })
    })

    test('can clear the coordinates', async ({ page, backend }) => {
      await page.getByTestId('admin-field-lat').fill('')
      await page.getByTestId('admin-field-long').fill('')
      await save(page).click()
      await expect(notice(page)).toBeVisible()
      expect(backend.find('universities', (u) => u.id === BOSTON)).toMatchObject({ lat: null, long: null })
    })

    test('has a map to place the pin', async ({ page }) => {
      await expect(page.getByTestId('coordinate-picker')).toBeVisible()
    })

    test('still needs a country', async ({ page }) => {
      await page.getByTestId('admin-field-country').fill('')
      await save(page).click()
      expect(await texts(fieldErrors(page))).toEqual(['Enter the country.'])
    })
  })

  test.describe('costs', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByTestId('admin-edit-cost').click()
    })

    test('opens with the published figures', async ({ page }) => {
      await expect(page.getByTestId('admin-field-currency')).toHaveValue('USD')
      await expect(page.getByTestId('admin-field-accommodation')).toHaveValue('1800')
    })

    test('previews what students will see in SGD', async ({ page }) => {
      await expect(page.getByTestId('admin-cost-preview')).toContainText('SGD')
    })

    test('saves new figures', async ({ page, backend }) => {
      await page.getByTestId('admin-field-accommodation').fill('2000')
      await page.getByTestId('admin-field-food').fill('900')
      await save(page).click()
      await expect(notice(page)).toHaveText('Costs saved.')
      expect(backend.find('university_costs', (c) => c.university_id === BOSTON)).toMatchObject({ currency_code: 'USD', accommodation: 2000, food: 900 })
      expect(backend.rows('university_costs').filter((c) => c.university_id === BOSTON)).toHaveLength(1)
    })

    test('a blank amount is saved as not available', async ({ page, backend }) => {
      await page.getByTestId('admin-field-transport').fill('')
      await save(page).click()
      await expect(notice(page)).toBeVisible()
      expect(backend.find('university_costs', (c) => c.university_id === BOSTON).transport).toBeNull()
    })

    test('asks for a currency when none is chosen yet', async ({ page, backend }) => {
      await page.getByTestId('admin-drawer-cancel').click()
      await openUniversity(page, ATLANTIS)
      await page.getByTestId('admin-edit-cost').click()
      await save(page).click()
      await expect(fieldErrors(page)).toContainText('Select a currency.')
      expect(backend.writes('university_costs')).toHaveLength(0)
    })

    test('changes the currency from the list', async ({ page, backend }) => {
      await page.getByTestId('admin-field-currency').selectOption('EUR')
      await save(page).click()
      await expect(notice(page)).toBeVisible()
      expect(backend.find('university_costs', (c) => c.university_id === BOSTON).currency_code).toBe('EUR')
    })

    test('rejects negative amounts', async ({ page, backend }) => {
      await page.getByTestId('admin-field-food').fill('-1')
      await save(page).click()
      expect(await texts(fieldErrors(page))).toEqual(['Food must be zero or a positive number.'])
      expect(backend.writes('university_costs')).toHaveLength(0)
    })

    test('the first costs for a new university are created, not updated', async ({ page, backend }) => {
      await page.getByTestId('admin-drawer-cancel').click()
      await openUniversity(page, ATLANTIS)
      await page.getByTestId('admin-edit-cost').click()
      await page.getByTestId('admin-field-currency').selectOption('EUR')
      await page.getByTestId('admin-field-accommodation').fill('1000')
      await save(page).click()
      await expect(notice(page)).toHaveText('Costs saved.')
      expect(backend.find('university_costs', (c) => c.university_id === ATLANTIS)).toMatchObject({ currency_code: 'EUR', accommodation: 1000 })
      await expect(page.getByTestId('admin-hidden-banner')).not.toContainText('costs')
    })
  })

  test.describe('academics', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByTestId('admin-edit-academics').click()
    })

    test('lists the current languages', async ({ page }) => {
      await expect(page.getByTestId('admin-language-list')).toContainText('English')
    })

    test('adds and removes languages', async ({ page, backend }) => {
      await page.getByTestId('admin-field-language').fill('Spanish')
      await page.getByTestId('admin-add-language').click()
      await page.getByTestId('admin-field-language').fill('French')
      await page.getByTestId('admin-field-language').press('Enter')
      await page.getByRole('button', { name: 'Remove English' }).click()
      await save(page).click()
      await expect(notice(page)).toHaveText('Academics saved.')
      const languages = backend.rows('university_languages').filter((l) => l.university_id === BOSTON).map((l) => l.instruction_language).sort()
      expect(languages).toEqual(['French', 'Spanish'])
    })

    test('does not add the same language twice', async ({ page }) => {
      await page.getByTestId('admin-field-language').fill('english')
      await page.getByTestId('admin-add-language').click()
      await expect(page.getByTestId('admin-remove-language')).toHaveCount(1)
    })

    test('a language typed but not added is not lost on save', async ({ page, backend }) => {
      await page.getByTestId('admin-field-language').fill('German')
      await save(page).click()
      await expect(notice(page)).toBeVisible()
      expect(backend.rows('university_languages').filter((l) => l.university_id === BOSTON).map((l) => l.instruction_language)).toContain('German')
    })

    test('saves the course catalogue link, and checks it', async ({ page, backend }) => {
      await page.getByTestId('admin-field-modules-url').fill('catalogue.bu.edu')
      await save(page).click()
      await expect(fieldErrors(page)).toContainText('Enter a valid URL')
      await page.getByTestId('admin-field-modules-url').fill('https://catalogue.bu.edu')
      await save(page).click()
      await expect(notice(page)).toBeVisible()
      expect(backend.find('universities', (u) => u.id === BOSTON).modules_url).toBe('https://catalogue.bu.edu')
    })
  })

  test.describe('exchange periods', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByTestId('admin-edit-exchange').click()
    })

    test('lists the existing periods', async ({ page }) => {
      await expect(page.getByTestId('admin-period-row')).toHaveCount(2)
      await expect(page.getByTestId('admin-period-name').first()).toHaveValue('Fall 2026')
    })

    test('adds a period', async ({ page, backend }) => {
      await page.getByTestId('admin-period-add').click()
      const row = page.getByTestId('admin-period-row').last()
      await row.getByTestId('admin-period-name').fill('Summer 2027')
      await row.getByTestId('admin-period-start').fill('2027-06-01')
      await row.getByTestId('admin-period-end').fill('2027-08-15')
      await row.getByTestId('admin-period-min').fill('15')
      await row.getByTestId('admin-period-max').fill('29')
      await save(page).click()
      await expect(notice(page)).toHaveText('Exchange periods saved.')
      expect(backend.rows('exchange_periods').filter((p) => p.university_id === BOSTON)).toHaveLength(3)
      expect(backend.find('exchange_periods', (p) => p.period_name === 'Summer 2027')).toMatchObject({ university_id: BOSTON, start_date: '2027-06-01', min_temperature: 15, max_temperature: 29 })
    })

    test('edits a period in place, keeping its id', async ({ page, backend }) => {
      const before = backend.find('exchange_periods', (p) => p.university_id === BOSTON && p.period_name === 'Fall 2026').id
      await page.getByTestId('admin-period-description').first().fill('Crisp autumn')
      await save(page).click()
      await expect(notice(page)).toBeVisible()
      expect(backend.find('exchange_periods', (p) => p.id === before).description).toBe('Crisp autumn')
    })

    test('warns before removing a period, and removes it on save', async ({ page, backend }) => {
      await page.getByTestId('admin-period-remove').first().click()
      await expect(page.getByTestId('admin-period-warning')).toBeVisible()
      await save(page).click()
      await expect(notice(page)).toBeVisible()
      expect(backend.rows('exchange_periods').filter((p) => p.university_id === BOSTON).map((p) => p.period_name)).toEqual(['Spring 2027'])
    })

    test('each row needs a name, sensible dates and temperatures', async ({ page, backend }) => {
      await page.getByTestId('admin-period-name').first().fill('')
      await page.getByTestId('admin-period-end').nth(1).fill('2020-01-01')
      await save(page).click()
      expect(await texts(fieldErrors(page))).toEqual(['Give the period a name.', 'End date cannot be before start date.'])
      await page.getByTestId('admin-period-name').first().fill('Fall 2026')
      await page.getByTestId('admin-period-end').nth(1).fill('2027-05-07')
      await page.getByTestId('admin-period-min').first().fill('30')
      await page.getByTestId('admin-period-max').first().fill('10')
      await save(page).click()
      await expect(fieldErrors(page)).toContainText('Highest temperature must be greater than lowest.')
      expect(backend.writes('exchange_periods')).toHaveLength(0)
    })

    test('removing every period leaves the university without any', async ({ page, backend }) => {
      await page.getByTestId('admin-period-remove').first().click()
      await page.getByTestId('admin-period-remove').first().click()
      await expect(page.getByTestId('admin-no-periods')).toBeVisible()
      await save(page).click()
      await expect(notice(page)).toBeVisible()
      expect(backend.rows('exchange_periods').filter((p) => p.university_id === BOSTON)).toHaveLength(0)
    })
  })
})

test.describe('admin: publishing and hiding', () => {
  test.beforeEach(async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
  })

  test('publishing makes a university visible to students; hiding takes it away again', async ({ page, person, backend }) => {
    const visitor = await person()
    const listed = async () => {
      await visitor.goto('/universities')
      await visitor.getByTestId('filter-search-input').fill('Atlantis')
      return visitor.getByTestId('university-card-name').count()
    }
    await openUniversity(page, ATLANTIS)
    expect(await listed()).toBe(0)
    await page.getByTestId('admin-publish').click()
    await expect(page.getByTestId('admin-hidden-banner')).toHaveCount(0)
    await expect(page.getByTestId('admin-hide')).toBeVisible()
    expect(await listed()).toBe(1)
    await page.getByTestId('admin-hide').click()
    await expect(page.getByTestId('admin-hidden-banner')).toBeVisible()
    expect(await listed()).toBe(0)
    expect(backend.find('universities', (u) => u.id === ATLANTIS).published).toBe(false)
  })

  test('the banner says what is still missing, and when it is ready', async ({ page, backend }) => {
    await openUniversity(page, ATLANTIS)
    await expect(page.getByTestId('admin-hidden-banner')).toContainText('Missing: a logo, a map location, costs, languages, exchange periods')
    const atlantis = backend.find('universities', (u) => u.id === ATLANTIS)
    Object.assign(atlantis, { logo_url: 'university-logos/atlantis.png', lat: 1, long: 1 })
    backend.files.set('university-logos/atlantis.png', { contentType: 'image/png', size: 1 })
    backend.rows('university_costs').push({ id: 99, university_id: ATLANTIS, currency_code: 'EUR', accommodation: 1 })
    backend.rows('university_languages').push({ id: 99, university_id: ATLANTIS, instruction_language: 'English' })
    backend.rows('exchange_periods').push({ id: 99, university_id: ATLANTIS, period_name: 'Fall' })
    await page.reload()
    await expect(page.getByTestId('admin-hidden-banner')).toContainText('All details complete - ready to publish.')
  })

  test('a failed publish shows the reason and changes nothing', async ({ page, backend }) => {
    await openUniversity(page, ATLANTIS)
    backend.fail('/rest/v1/universities', { status: 500, body: { message: 'database is down' }, times: 1 })
    await page.getByTestId('admin-publish').click()
    await expect(page.getByTestId('admin-bar-error')).toHaveText('database is down')
    await expect(page.getByTestId('admin-publish')).toBeVisible()
  })

  test('a student who already had the page open sees it vanish on their next load', async ({ page, person }) => {
    const student = await person()
    await student.goto(`/universities/${BOSTON}`)
    await expect(student.getByRole('heading', { level: 1 })).toContainText('Boston University')
    await openUniversity(page, BOSTON)
    await page.getByTestId('admin-hide').click()
    await expect(page.getByTestId('admin-hidden-banner')).toBeVisible()
    await student.reload()
    await expect(student.getByRole('heading', { level: 1, name: /Boston University/ })).toHaveCount(0)
  })

  test('a hidden university drops out of a student\'s shortlist view', async ({ page, person, backend }) => {
    const studentUser = backend.createUser()
    backend.shortlist(studentUser, [BOSTON, 5])
    const student = await person(studentUser)
    await student.goto('/shortlist')
    await expect(student.getByTestId('shortlist-item')).toHaveCount(2)
    await openUniversity(page, BOSTON)
    await page.getByTestId('admin-hide').click()
    await expect(page.getByTestId('admin-hidden-banner')).toBeVisible()
    await student.reload()
    await expect(student.getByTestId('shortlist-item')).toHaveCount(1)
    await expect(student.getByTestId('shortlist-item')).toContainText('Kyoto University')
  })
})

test.describe('admin: deleting', () => {
  test.beforeEach(async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
  })

  test('is only possible once the university is hidden', async ({ page }) => {
    await openUniversity(page, BOSTON)
    await expect(page.getByTestId('admin-delete')).toBeDisabled()
    await page.getByTestId('admin-hide').click()
    await expect(page.getByTestId('admin-delete')).toBeEnabled()
  })

  test('shows what would be lost and needs the name typed', async ({ page, backend }) => {
    const student = backend.createUser()
    backend.shortlist(student, [ATLANTIS])
    backend.rows('user_budgets').push({ id: 1, user_id: student.id, university_id: ATLANTIS, duration_months: 4, currency_code: 'SGD', total_budget: 1, accommodation_budget: 1 })
    backend.rows('university_reviews').push({ id: 80, user_id: student.id, university_id: ATLANTIS, rating: 3, review: 'Wet', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    backend.rows('timetables').push({ id: 1, user_id: student.id, university_id: ATLANTIS, exchange_period_id: 99 })
    await openUniversity(page, ATLANTIS)
    await page.getByTestId('admin-delete').click()
    const impact = page.getByTestId('delete-impact')
    await expect(impact).toContainText('1 student shortlist')
    await expect(impact).toContainText('1 budget')
    await expect(impact).toContainText('1 review and their comments')
    await expect(impact).toContainText('1 timetable')
    await expect(page.getByTestId('confirm-ok')).toBeDisabled()
    await page.getByTestId('confirm-typed-input').fill('atlantis institute')
    await expect(page.getByTestId('confirm-ok')).toBeDisabled()
    await page.getByTestId('confirm-typed-input').fill('Atlantis Institute')
    await expect(page.getByTestId('confirm-ok')).toBeEnabled()
  })

  test('Cancel keeps everything', async ({ page, backend }) => {
    await openUniversity(page, ATLANTIS)
    await page.getByTestId('admin-delete').click()
    await page.getByTestId('confirm-cancel').click()
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0)
    expect(universityNamed(backend, 'Atlantis Institute')).toBeTruthy()
  })

  test('deleting removes the university and everything attached to it', async ({ page, backend }) => {
    const student = backend.createUser()
    backend.shortlist(student, [ATLANTIS])
    backend.rows('university_reviews').push({ id: 80, user_id: student.id, university_id: ATLANTIS, rating: 3, review: 'Wet', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    backend.rows('review_comments').push({ id: 80, review_id: 80, user_id: student.id, body: 'Yes', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    backend.rows('exchange_periods').push({ id: 99, university_id: ATLANTIS, period_name: 'Fall' })
    await openUniversity(page, ATLANTIS)
    await page.getByTestId('admin-delete').click()
    await page.getByTestId('confirm-typed-input').fill('Atlantis Institute')
    await page.getByTestId('confirm-ok').click()
    await expect(page.getByTestId('universities-page')).toBeVisible()
    await expect(page.getByTestId('university-card-name').filter({ hasText: 'Atlantis Institute' })).toHaveCount(0)
    expect(universityNamed(backend, 'Atlantis Institute')).toBeUndefined()
    expect(backend.rows('shortlists').filter((s) => s.university_id === ATLANTIS)).toHaveLength(0)
    expect(backend.rows('university_reviews').filter((r) => r.university_id === ATLANTIS)).toHaveLength(0)
    expect(backend.rows('review_comments').filter((c) => c.review_id === 80)).toHaveLength(0)
    expect(backend.rows('exchange_periods').filter((p) => p.university_id === ATLANTIS)).toHaveLength(0)
  })

  test('removes the logo file, unless another university shares it', async ({ page, backend }) => {
    backend.files.set('university-logos/own.png', { contentType: 'image/png', size: 1 })
    backend.find('universities', (u) => u.id === ATLANTIS).logo_url = 'university-logos/own.png'
    await openUniversity(page, ATLANTIS)
    await page.getByTestId('admin-delete').click()
    await page.getByTestId('confirm-typed-input').fill('Atlantis Institute')
    await page.getByTestId('confirm-ok').click()
    await expect(page.getByTestId('universities-page')).toBeVisible()
    await idle(page)
    expect(backend.files.has('university-logos/own.png')).toBe(false)
  })

  test('shows the error and keeps the university when the server refuses', async ({ page, backend }) => {
    await openUniversity(page, ATLANTIS)
    await page.getByTestId('admin-delete').click()
    backend.fail('/rest/v1/universities', { status: 500, body: { message: 'database is down' }, times: 1 })
    await page.getByTestId('confirm-typed-input').fill('Atlantis Institute')
    await page.getByTestId('confirm-ok').click()
    await expect(page.getByTestId('confirm-error')).toHaveText('database is down')
    expect(universityNamed(backend, 'Atlantis Institute')).toBeTruthy()
  })

  test('the database refuses to delete a published university even if the page is bypassed', async ({ page, backend }) => {
    await openUniversity(page, BOSTON)
    const outcome = await page.evaluate(async ({ key, url, anon }) => {
      const session = JSON.parse(localStorage.getItem(key))
      const response = await fetch(`${url}/rest/v1/universities?id=eq.2`, {
        method: 'DELETE',
        headers: { apikey: anon, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=representation' },
      })
      return response.json()
    }, { key: 'sb-mock-auth-token', url: 'https://mock.supabase.co', anon: 'mock-anon-key' })
    expect(outcome).toEqual([])
    expect(universityNamed(backend, 'Boston University')).toBeTruthy()
  })
})

test.describe('admin: moderation', () => {
  test('an admin\'s removal of a review is visible to students at once', async ({ page, admin, backend, person }) => {
    await signIn(page, admin, backend)
    await page.goto('/universities/7')
    await expect(page.getByTestId('review-carousel')).toBeVisible()
    await idle(page)
    await page.locator('.carousel-item.active').getByTestId('review-remove-btn').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(page.getByTestId('notice-success-message')).toHaveText('The review was removed successfully.')
    const student = await person()
    await student.goto('/universities/7')
    await expect(student.getByTestId('reviews-average')).toContainText('from 1 review')
  })
})
