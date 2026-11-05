import { test, expect } from './support/fixtures.js'
import { idle, signIn, texts } from './support/ui.js'
import { RATES, distanceFromSmu, universityNamed } from './support/seed.js'

const SLOTS_KEY = 'SMUXchange_compare_slots'

const selects = (page) => page.getByTestId('compare-university-select')
const slot = (page, n) => selects(page).nth(n)
const emptySlots = (page) => page.locator('.uni-logo', { hasText: 'Choose a University' })
// the icon glyph is part of the button's accessible name, so match around it
const shortlistButton = (page) => page.getByRole('button', { name: /^\W*Shortlist$/ })
const shortlistedButton = (page) => page.getByRole('button', { name: /^\W*Shortlisted$/ })

async function openCompare(page) {
  await page.goto('/compare')
  await expect(page.getByTestId('compare-heading')).toBeVisible()
  await expect(selects(page)).toHaveCount(3)
  await idle(page)
}

async function pick(page, n, name) {
  await slot(page, n).selectOption({ label: name })
}

/** The value shown in each column for a row label such as "Region" (the cell right under the label). */
async function rowValues(page, label) {
  return texts(
    page.locator('xpath=//div[normalize-space(text())="' + label + '"]/ancestor::*[contains(@class,"row")][1]/following-sibling::*[1]/*'),
  )
}

const slotsInStorage = (page) => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? 'null'), SLOTS_KEY)

test.describe('compare: picking universities', () => {
  test('starts with three empty slots and a prompt to choose', async ({ page }) => {
    await openCompare(page)
    await expect(emptySlots(page)).toHaveCount(3)
    for (let i = 0; i < 3; i++) await expect(slot(page, i)).toHaveValue('')
  })

  test('offers every visible university but not the hidden one', async ({ page }) => {
    await openCompare(page)
    const options = await texts(slot(page, 0).locator('option'))
    expect(options).toContain('Boston University')
    expect(options).toContain('University College London')
    expect(options).not.toContain('Atlantis Institute')
    expect(options.filter((o) => o !== 'Choose a University')).toHaveLength(14)
  })

  test('shows a university\'s details once chosen', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Kyoto University')
    await expect(page.getByAltText(/Kyoto/i).or(page.locator('.uni-logo img')).first()).toBeVisible()
    await expect(page.getByText('Japan', { exact: true })).toBeVisible()
    const kyoto = universityNamed('Kyoto University')
    await expect(page.getByText(`${distanceFromSmu(kyoto.lat, kyoto.long)} km`)).toBeVisible()
  })

  test('compares three universities side by side', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    await pick(page, 1, 'Kyoto University')
    await pick(page, 2, 'University College London')
    await expect(page.getByText('Japan', { exact: true })).toBeVisible()
    await expect(page.getByText('United States', { exact: true })).toBeVisible()
    await expect(page.getByText('United Kingdom', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Visit Website' })).toHaveCount(3)
  })

  test('a university already in one slot cannot be picked in another', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    await expect(slot(page, 1).getByRole('option', { name: 'Boston University' })).toBeDisabled()
  })

  test('clearing a slot empties it', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    await slot(page, 0).selectOption('')
    await expect(emptySlots(page)).toHaveCount(3)
  })

  test('clicking an empty slot\'s placeholder is a way to choose', async ({ page }) => {
    await openCompare(page)
    await page.getByRole('button', { name: /Choose a University/ }).first().click()
    await expect(slot(page, 0)).toBeVisible()
  })
})

test.describe('compare: remembering the selection', () => {
  test('keeps the three slots in the tab\'s session storage', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    await pick(page, 1, 'Kyoto University')
    await expect.poll(() => slotsInStorage(page)).toEqual([2, 5, null])
  })

  test('restores the selection after a reload', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    await pick(page, 2, 'Kyoto University')
    await page.reload()
    await expect(selects(page)).toHaveCount(3)
    // the app packs chosen universities to the left, so Kyoto moved up to the second slot
    await expect(slot(page, 0)).toHaveValue('2')
    await expect(slot(page, 1)).toHaveValue('5')
    await expect(slot(page, 2)).toHaveValue('')
  })

  test('survives leaving for another page and coming back', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    await page.getByTestId('nav-toggle').click()
    await page.getByTestId('nav-about').click()
    await expect(page).toHaveURL(/\/about$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/compare$/)
    await expect(slot(page, 0)).toHaveValue('2')
  })

  test('does not share a selection between tabs of different sessions', async ({ page, person }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    const other = await person()
    await openCompare(other)
    await expect(slot(other, 0)).toHaveValue('')
  })

  for (const [label, stored] of [
    ['not an array', '"nope"'],
    ['the wrong length', '[2,5]'],
    ['duplicates', '[2,2,5]'],
    ['negative ids', '[-1,2,5]'],
    ['broken JSON', '{oops'],
  ]) {
    test(`ignores a stored selection that is ${label}`, async ({ page }) => {
      await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [SLOTS_KEY, stored])
      await openCompare(page)
      for (let i = 0; i < 3; i++) await expect(slot(page, i)).toHaveValue('')
    })
  }

  test('drops a stored university that does not exist (or is hidden)', async ({ page }) => {
    await page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [SLOTS_KEY, '[15,2,999]'])
    await openCompare(page)
    await expect(slot(page, 0)).toHaveValue('')
    await expect(slot(page, 1)).toHaveValue('2')
    await expect(slot(page, 2)).toHaveValue('')
  })
})

test.describe('compare: the figures', () => {
  test('location, region, timezone and distance come from the university', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'University College London')
    const ucl = universityNamed('University College London')
    await expect(page.getByText('London, England, United Kingdom').first()).toBeVisible()
    await expect(page.getByText(ucl.region, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(`${distanceFromSmu(ucl.lat, ucl.long)} km`)).toBeVisible()
  })

  test('shows costs in the university\'s own currency, with the SGD rate', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Kyoto University')
    await expect(page.getByText(`1 SGD = ${RATES.JPY} JPY`)).toBeVisible()
    await expect(page.getByText(/¥|JPY/).first()).toBeVisible()
  })

  test('switches a column to SGD and back without touching the others', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Kyoto University')
    await pick(page, 1, 'Boston University')
    const before = await rowValues(page, 'Estimated Monthly Total')
    await page.getByRole('button', { name: 'SGD', exact: true }).first().click()
    const after = await rowValues(page, 'Estimated Monthly Total')
    expect(after[0]).toMatch(/^\$/)
    expect(after[0]).not.toMatch(/¥|JPY/)
    expect(after[0]).not.toEqual(before[0])
    expect(after[1]).toEqual(before[1])
    await page.getByRole('button', { name: 'JPY', exact: true }).click()
    expect(await rowValues(page, 'Estimated Monthly Total')).toEqual(before)
  })

  test('converts to SGD using the day\'s rate', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Kyoto University')
    const yen = (await rowValues(page, 'Accommodation'))[0]
    const amount = Number(yen.replace(/[^\d.]/g, ''))
    await page.getByRole('button', { name: 'SGD', exact: true }).click()
    const sgd = Number((await rowValues(page, 'Accommodation'))[0].replace(/[^\d.]/g, ''))
    expect(Math.abs(sgd - Math.round(amount / RATES.JPY))).toBeLessThanOrEqual(1)
  })

  test('shows both exchange periods and switches between them', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    const periods = page.getByRole('button', { name: /Fall|Aug|Sep|2026|2027/ })
    await expect(periods.first()).toBeVisible()
    const first = await rowValues(page, 'Programme')
    await periods.nth(1).click()
    expect(await rowValues(page, 'Programme')).not.toEqual(first)
  })

  test('shows the number of mapped modules and the language', async ({ page, backend }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    await pick(page, 1, 'Koc University')
    const mapped = await rowValues(page, 'Mapped Modules')
    expect(mapped[0]).toBe('12')
    expect(Number(mapped[1])).toBe(backend.rows('university_modules').filter((m) => m.university_id === 9).length)
  })

  test('picking a different university resets that column\'s currency and period', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Kyoto University')
    await page.getByRole('button', { name: 'SGD', exact: true }).click()
    await pick(page, 0, 'Boston University')
    await expect(page.getByRole('button', { name: 'USD', exact: true })).toHaveClass(/btn-primary/)
  })
})

test.describe('compare: shortlisting from here', () => {
  test('a logged-out visitor is sent to log in and returned to compare', async ({ page }) => {
    await openCompare(page)
    await pick(page, 0, 'Boston University')
    await page.getByRole('button', { name: /Shortlist/ }).click()
    await expect(page).toHaveURL(/\/login/)
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/compare')
  })

  test.describe('signed in', () => {
    test.beforeEach(async ({ page, student, backend }) => {
      await signIn(page, student, backend)
    })

    test('shortlists a university and groups it first in every dropdown', async ({ page, student, backend }) => {
      await openCompare(page)
      await pick(page, 0, 'Boston University')
      await shortlistButton(page).click()
      await expect(shortlistedButton(page)).toBeVisible()
      expect(backend.rows('shortlists').filter((s) => s.user_id === student.id).map((s) => s.university_id)).toEqual([2])
      await expect(slot(page, 1).locator('optgroup[label="My Shortlist"]')).toContainText('Boston University')
    })

    test('removes it again', async ({ page, student, backend }) => {
      backend.shortlist(student, [2])
      await openCompare(page)
      await pick(page, 0, 'Boston University')
      await shortlistedButton(page).click()
      await expect(shortlistButton(page)).toBeVisible()
      expect(backend.rows('shortlists').filter((s) => s.user_id === student.id)).toHaveLength(0)
    })

    test('already shortlisted universities show as such', async ({ page, student, backend }) => {
      backend.shortlist(student, [5])
      await openCompare(page)
      await pick(page, 0, 'Kyoto University')
      await expect(shortlistedButton(page)).toBeVisible()
      await expect(slot(page, 0).locator('optgroup[label="My Shortlist"]')).toContainText('Kyoto University')
    })

    test('stays consistent with the Shortlist page', async ({ page }) => {
      await openCompare(page)
      await pick(page, 0, 'Kyoto University')
      await shortlistButton(page).click()
      await expect(shortlistedButton(page)).toBeVisible()
      await page.goto('/shortlist')
      await expect(page.getByTestId('shortlist-item')).toHaveCount(1)
      await expect(page.getByTestId('shortlist-item')).toContainText('Kyoto University')
    })
  })
})

test.describe('compare: admins and hidden universities', () => {
  test('a hidden university is not offered to students', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openCompare(page)
    expect(await texts(slot(page, 0).locator('option'))).not.toContain('Atlantis Institute')
  })

  test('an admin can compare a hidden university', async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await openCompare(page)
    expect(await texts(slot(page, 0).locator('option'))).toContain('Atlantis Institute')
  })

  test('hidden ones are dropped from the selection when the admin previews as a student', async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await openCompare(page)
    await pick(page, 0, 'Atlantis Institute')
    await page.getByTestId('nav-toggle').click()
    await page.getByTestId('nav-preview-toggle').click()
    await page.reload()
    await expect(selects(page)).toHaveCount(3)
    await expect(slot(page, 0)).toHaveValue('')
  })
})

test.describe('compare: when things go wrong', () => {
  test('still shows the page if exchange rates cannot be fetched', async ({ page }) => {
    await page.context().route('**/api.frankfurter.dev/**', (route) => route.fulfill({ status: 500, body: 'nope' }))
    await openCompare(page)
    await pick(page, 0, 'Kyoto University')
    await expect(page.getByText('1 SGD = - JPY')).toBeVisible()
    await page.getByRole('button', { name: 'SGD', exact: true }).click()
    // no rate: it keeps showing the home currency instead of a wrong number
    expect((await rowValues(page, 'Accommodation'))[0]).toMatch(/¥|JPY/)
  })

  test('shows empty slots rather than crashing when universities fail to load', async ({ page, backend }) => {
    backend.fail('/rest/v1/universities', { status: 500, body: { message: 'boom' } })
    await page.goto('/compare')
    await expect(page.getByTestId('compare-heading')).toBeVisible()
  })
})
