import { test, expect } from './support/fixtures.js'
import { card, idle, openUniversities, signIn, texts } from './support/ui.js'

const items = (page) => page.getByTestId('shortlist-item')
const itemNames = (page) => texts(items(page).locator('.shortlist-name'))

test.describe('your shortlist', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
  })

  test('is empty to begin with and points to the universities', async ({ page }) => {
    await page.goto('/shortlist')
    await expect(page.getByTestId('shortlist-empty')).toContainText('Nothing shortlisted yet')
    await page.getByTestId('shortlist-empty').getByRole('link', { name: 'Browse Partner Universities' }).click()
    await expect(page).toHaveURL(/\/universities$/)
  })

  test('lists what was shortlisted, with the name, place and logo', async ({ page, student, backend }) => {
    backend.shortlist(student, [5, 2])
    await page.goto('/shortlist')
    await expect(items(page)).toHaveCount(2)
    const boston = items(page).filter({ hasText: 'Boston University' })
    await expect(boston).toContainText('Boston, United States')
    const logo = boston.getByAltText('Boston University logo')
    await expect.poll(() => logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
  })

  test('shows the most recently added first, and can sort by name or country', async ({ page, student, backend }) => {
    backend.shortlist(student, [5, 2, 7]) // Kyoto, then Boston, then UCL
    await page.goto('/shortlist')
    expect(await itemNames(page)).toEqual(['University College London', 'Boston University', 'Kyoto University'])
    await page.getByLabel('Sort Shortlist').selectOption('name')
    expect(await itemNames(page)).toEqual(['Boston University', 'Kyoto University', 'University College London'])
    await page.getByLabel('Sort Shortlist').selectOption('country')
    expect(await itemNames(page)).toEqual(['Kyoto University', 'University College London', 'Boston University']) // Japan, United Kingdom, United States
  })

  test('only shows this student\'s own shortlist', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    backend.shortlist(backend.createUser(), [5, 7])
    await page.goto('/shortlist')
    expect(await itemNames(page)).toEqual(['Boston University'])
  })

  test('Details and Plan Schedule go to the right university', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await page.goto('/shortlist')
    await items(page).getByRole('link', { name: 'Details' }).click()
    await expect(page).toHaveURL(/\/universities\/2$/)
    await page.goBack()
    await items(page).getByTestId('shortlist-schedule-link').click()
    await expect(page).toHaveURL(/\/schedule\/2(\?period=\d+)?$/)
  })

  test('shows a loading message while the shortlist arrives', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    backend.slow('/rest/v1/shortlists', 600)
    await page.goto('/shortlist')
    await expect(page.getByTestId('shortlist-loading')).toBeVisible()
    await expect(items(page)).toHaveCount(1)
  })
})

test.describe('removing', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    backend.shortlist(student, [2, 5])
  })

  test('takes it off the list straight away and says so', async ({ page, backend }) => {
    await page.goto('/shortlist')
    await items(page).filter({ hasText: 'Boston University' }).getByTestId('shortlist-remove-btn').click()
    await expect(items(page)).toHaveCount(1)
    await expect(page.getByTestId('notice-success-message')).toHaveText('Boston University removed from your shortlist.')
    expect(backend.rows('shortlists').map((r) => r.university_id)).toEqual([5])
    await page.reload()
    expect(await itemNames(page)).toEqual(['Kyoto University'])
  })

  test('removing the last one shows the empty message', async ({ page }) => {
    await page.goto('/shortlist')
    await items(page).first().getByTestId('shortlist-remove-btn').click()
    await items(page).first().getByTestId('shortlist-remove-btn').click()
    await expect(page.getByTestId('shortlist-empty')).toBeVisible()
  })

  test('the success message can be dismissed', async ({ page }) => {
    await page.goto('/shortlist')
    await items(page).first().getByTestId('shortlist-remove-btn').click()
    await page.getByTestId('notice-dismiss-success').click()
    await expect(page.getByTestId('notice-success-message')).toHaveCount(0)
  })

  test('a failed removal says why and keeps the university listed', async ({ page, backend }) => {
    await page.goto('/shortlist')
    backend.fail({ method: 'DELETE', path: '/rest/v1/shortlists' }, { status: 500, body: { code: 'XX000', message: 'could not remove' } })
    await items(page).first().getByTestId('shortlist-remove-btn').click()
    await expect(page.getByTestId('shortlist-error')).toContainText('could not remove')
    await expect(items(page)).toHaveCount(2)
    expect(backend.rows('shortlists')).toHaveLength(2)
  })

  test('the new shortlist shows on the university list too', async ({ page }) => {
    await page.goto('/shortlist')
    await items(page).filter({ hasText: 'Boston University' }).getByTestId('shortlist-remove-btn').click()
    await expect(items(page)).toHaveCount(1)
    await openUniversities(page)
    await expect(card(page, 'Boston University').getByTestId('shortlist-add-btn')).toBeVisible()
  })
})

test.describe('a long shortlist', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    backend.shortlist(student, [1, 2, 3, 4, 5, 6, 7, 8]) // eight, so two pages of five
  })

  test('is split into pages of five', async ({ page }) => {
    await page.goto('/shortlist')
    await expect(items(page)).toHaveCount(5)
    const pagination = page.getByTestId('shortlist-pagination')
    await pagination.getByRole('button', { name: 'Page 2' }).click()
    await expect(items(page)).toHaveCount(3)
    await expect(pagination.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  test('removing the last item of the last page moves back instead of showing an empty page', async ({ page }) => {
    await page.goto('/shortlist')
    const pagination = page.getByTestId('shortlist-pagination')
    await pagination.getByRole('button', { name: 'Page 2' }).click()
    await items(page).nth(0).getByTestId('shortlist-remove-btn').click()
    await items(page).nth(0).getByTestId('shortlist-remove-btn').click()
    await items(page).nth(0).getByTestId('shortlist-remove-btn').click()
    await expect(items(page)).toHaveCount(5)
    await expect(page.getByTestId('shortlist-pagination')).toHaveCount(0)
  })

  test('sorting keeps you on a valid page', async ({ page }) => {
    await page.goto('/shortlist')
    await page.getByTestId('shortlist-pagination').getByRole('button', { name: 'Page 2' }).click()
    await page.getByLabel('Sort Shortlist').selectOption('name')
    await expect(items(page).first()).toBeVisible()
  })
})

test.describe('hidden universities', () => {
  test('a student does not see a hidden university that is on their shortlist', async ({ page, student, backend }) => {
    backend.shortlist(student, [2, 15]) // 15 is hidden
    await signIn(page, student, backend)
    await page.goto('/shortlist')
    expect(await itemNames(page)).toEqual(['Boston University'])
  })

  test('an admin sees it, as they can see everything', async ({ page, admin, backend }) => {
    backend.shortlist(admin, [2, 15])
    await signIn(page, admin, backend)
    await page.goto('/shortlist')
    await expect(items(page)).toHaveCount(2)
    await idle(page)
  })
})
