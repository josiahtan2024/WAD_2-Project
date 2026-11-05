import { test, expect } from './support/fixtures.js'
import { openUniversity, signIn, texts } from './support/ui.js'
import { VISIBLE_UNIVERSITIES, monthlyCostSgd } from './support/seed.js'

const regionButton = (page, region) => page.getByTestId('home-university-list').getByRole('button', { name: new RegExp(`\\b${region}\\b`) })
const listed = (page) => texts(page.getByTestId('home-university-list').locator('.uni-name'))
const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Middle-East', 'Oceania']

async function openHome(page, query = '') {
  await page.goto(`/${query}`)
  await expect(page.getByTestId('home-university-list')).toBeVisible()
}

test.describe('browsing by region', () => {
  test('shows how many partner universities there are and every region with its count', async ({ page }) => {
    await openHome(page)
    await expect(page.getByTestId('home-page')).toContainText(`${VISIBLE_UNIVERSITIES.length} Unis`)
    const headers = await texts(page.getByTestId('home-university-list').getByRole('button'))
    expect(headers.map((h) => h.replace(/\s*\d+$/, ''))).toEqual(REGIONS)
    for (const region of REGIONS) {
      const expected = VISIBLE_UNIVERSITIES.filter((u) => u.region === region).length
      await expect(regionButton(page, region)).toContainText(String(expected))
    }
  })

  test('every region starts collapsed', async ({ page }) => {
    await openHome(page)
    for (const region of REGIONS) await expect(regionButton(page, region)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('info-empty')).toBeVisible()
  })

  test('opening a region lists its universities A to Z and hides the other regions until it is closed', async ({ page }) => {
    await openHome(page)
    await regionButton(page, 'Europe').click()
    await expect(regionButton(page, 'Europe')).toHaveAttribute('aria-expanded', 'true')
    const europe = VISIBLE_UNIVERSITIES.filter((u) => u.region === 'Europe').map((u) => u.name).sort((a, b) => a.localeCompare(b))
    await expect.poll(() => listed(page).then((all) => all.filter((n) => europe.includes(n)))).toEqual(europe)
    await expect(regionButton(page, 'Asia')).toHaveCount(0)
    await regionButton(page, 'Europe').click()
    await regionButton(page, 'Asia').click()
    await expect(regionButton(page, 'Asia')).toHaveAttribute('aria-expanded', 'true')
    await expect(regionButton(page, 'Europe')).toHaveCount(0)
  })

  test('clicking the open region again closes it', async ({ page }) => {
    await openHome(page)
    await regionButton(page, 'Asia').click()
    await regionButton(page, 'Asia').click()
    await expect(regionButton(page, 'Asia')).toHaveAttribute('aria-expanded', 'false')
  })
})

test.describe('choosing a university', () => {
  test('shows its name, place, monthly cost and a link to its page', async ({ page }) => {
    await openHome(page)
    await regionButton(page, 'Asia').click()
    await page.getByTestId('home-university-list').getByText('Kyoto University', { exact: true }).click()
    await expect(page.getByTestId('info-name')).toHaveText('Kyoto University')
    const panel = page.getByTestId('info-panel')
    await expect(panel).toContainText('Kyoto, Japan')
    await expect(panel).toContainText(`SGD ${Math.round(monthlyCostSgd(5)).toLocaleString('en-US')}`)
    // leaving while the map is still flying to the marker makes Leaflet throw, so let it finish first
    await page.waitForFunction(() => !document.querySelector('.leaflet-zoom-anim, .leaflet-pan-anim, .leaflet-fade-anim.leaflet-zoom-anim'))
    await page.waitForTimeout(600)
    await page.getByTestId('info-details-link').click()
    await expect(page).toHaveURL(/\/universities\/5$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kyoto University')
  })

  test('the chosen university is highlighted, and choosing it again clears the panel', async ({ page }) => {
    await openHome(page)
    await regionButton(page, 'Asia').click()
    const item = page.getByTestId('home-university-list').locator('li').filter({ hasText: 'Yonsei University' })
    await item.click()
    await expect(item).toHaveClass(/is-selected/)
    await item.click()
    await expect(item).not.toHaveClass(/is-selected/)
    await expect(page.getByTestId('info-empty')).toBeVisible()
  })

  test('can be chosen with the keyboard', async ({ page }) => {
    await openHome(page)
    await regionButton(page, 'Asia').click()
    const item = page.getByTestId('home-university-list').locator('li').filter({ hasText: 'Fudan University' })
    await item.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('info-name')).toHaveText('Fudan University')
  })

  test('choosing another university replaces the first', async ({ page }) => {
    await openHome(page)
    await regionButton(page, 'Asia').click()
    await page.getByTestId('home-university-list').getByText('Kyoto University', { exact: true }).click()
    await page.getByTestId('home-university-list').getByText('Fudan University', { exact: true }).click()
    await expect(page.getByTestId('info-name')).toHaveText('Fudan University')
  })
})

test.describe('links that open a particular university', () => {
  test('"Open Map" on a university page opens the map with that university selected and its region open', async ({ page }) => {
    await openUniversity(page, 'Kyoto University')
    await page.getByRole('link', { name: 'Open Map' }).click()
    await expect(page.getByTestId('info-name')).toHaveText('Kyoto University')
    await expect(regionButton(page, 'Asia')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('map-panel').locator('.university-marker.selected')).toHaveCount(1)
  })

  test.fixme('opening ?university=5 directly (a bookmark or a refresh) selects it', async ({ page }) => {
    // Known gap: on a fresh load the map resets itself before the universities have arrived,
    // and that reset removes ?university=5 from the address, so nothing ends up selected.
    await openHome(page, '?university=5')
    await expect(page.getByTestId('info-name')).toHaveText('Kyoto University')
  })

  for (const id of ['9999', 'abc', '15']) {
    test(`?university=${id} selects nothing`, async ({ page }) => {
      await openHome(page, `?university=${id}`)
      await expect(page.getByTestId('info-empty')).toBeVisible()
    })
  }

})

test.describe('the map', () => {
  test('shows markers for the universities, grouped where they are close together', async ({ page }) => {
    await openHome(page)
    const map = page.getByTestId('map-panel')
    await expect(map.locator('img.leaflet-tile').first()).toBeVisible()
    await expect(map.locator('.leaflet-marker-icon').first()).toBeVisible()
    // 14 universities, so the pins that sit close together must have been merged into groups
    expect(await map.locator('.marker-cluster').count()).toBeGreaterThan(0)
    expect(await map.locator('.leaflet-marker-icon').count()).toBeLessThan(VISIBLE_UNIVERSITIES.length)
  })

  test('choosing a university from the list zooms the map to its marker', async ({ page }) => {
    await openHome(page)
    await regionButton(page, 'Europe').click()
    await page.getByTestId('home-university-list').getByText('Technical University of Munich', { exact: true }).click()
    await expect(page.getByTestId('map-panel').locator('.university-marker.selected')).toHaveCount(1)
  })

  test('clicking the selected marker deselects it', async ({ page }) => {
    await openUniversity(page, 'Technical University of Munich')
    await page.getByRole('link', { name: 'Open Map' }).click()
    const marker = page.getByTestId('map-panel').locator('.university-marker.selected')
    await expect(marker).toHaveCount(1)
    await expect(marker.locator('xpath=..')).toBeVisible({ timeout: 10_000 })
    await marker.locator('xpath=..').click()
    await expect(page.getByTestId('info-empty')).toBeVisible()
  })

  test('"Reset map" clears the selection and the link parameter', async ({ page }) => {
    await openUniversity(page, 'Kyoto University')
    await page.getByRole('link', { name: 'Open Map' }).click()
    await expect(page.getByTestId('info-name')).toHaveText('Kyoto University')
    expect(new URL(page.url()).searchParams.get('university')).toBe('5')
    await page.getByRole('button', { name: 'Reset map to world view' }).click()
    await expect(page.getByTestId('info-empty')).toBeVisible()
    await expect.poll(() => new URL(page.url()).searchParams.get('university')).toBeNull()
  })

  test('a university without coordinates is still in the list but has no marker', async ({ page, backend }) => {
    Object.assign(backend.rows('universities').find((u) => u.id === 12), { lat: null, long: null })
    await openHome(page)
    await regionButton(page, 'Europe').click()
    await page.getByTestId('home-university-list').getByText('Technical University of Munich', { exact: true }).click()
    await expect(page.getByTestId('info-name')).toHaveText('Technical University of Munich')
    await expect(page.getByTestId('map-panel').locator('.university-marker.selected')).toHaveCount(0)
  })
})

test.describe('loading and errors', () => {
  test('says so while the universities are on their way', async ({ page, backend }) => {
    backend.slow('/rest/v1/universities', 700)
    await page.goto('/')
    await expect(page.getByText('Loading universities...')).toBeVisible()
    await expect(page.getByTestId('home-university-list')).toBeVisible()
  })

  test('shows an error instead of an empty list when they cannot be loaded', async ({ page, backend }) => {
    backend.fail('/rest/v1/universities', { status: 500, body: { code: 'XX000', message: 'database is down' } })
    await page.goto('/')
    await expect(page.getByTestId('home-error')).toContainText('database is down')
  })

  test('says there are none when there really are none', async ({ page, backend }) => {
    backend.tables.universities = []
    await page.goto('/')
    await expect(page.getByText('No partner universities found.')).toBeVisible()
  })
})

test.describe('what students and staff see', () => {
  test('a student does not see the hidden university anywhere on the page', async ({ page }) => {
    await openHome(page)
    await expect(page.getByTestId('home-page')).not.toContainText('Atlantis')
    await expect(page.getByTestId('home-page')).toContainText(`${VISIBLE_UNIVERSITIES.length} Unis`)
  })

  test('an admin sees it too, so the count is one higher', async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await openHome(page)
    await expect(page.getByTestId('home-page')).toContainText(`${VISIBLE_UNIVERSITIES.length + 1} Unis`)
    await regionButton(page, 'Oceania').click()
    await expect(page.getByTestId('home-university-list')).toContainText('Atlantis Institute')
  })
})
