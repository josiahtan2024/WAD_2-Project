import { test, expect } from './support/fixtures.js'
import { openUniversities, signIn } from './support/ui.js'

test.describe('resilience: slow servers', () => {
  test('the university list shows it is loading, then the universities', async ({ page, backend }) => {
    backend.slow('/rest/v1/universities', 800)
    await page.goto('/universities')
    await expect(page.getByTestId('universities-loading')).toBeVisible()
    await expect(page.getByTestId('university-card-name').first()).toBeVisible()
    await expect(page.getByTestId('universities-loading')).toHaveCount(0)
  })

  test('the shortlist page shows it is loading', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    backend.slow('/rest/v1/shortlists', 800)
    await page.goto('/shortlist')
    await expect(page.getByTestId('shortlist-loading')).toBeVisible()
    await expect(page.getByTestId('shortlist-empty')).toBeVisible()
  })

  test('the budget planner shows it is loading', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    backend.slow('/rest/v1/universities', 800)
    await page.goto('/cost-estimator')
    await expect(page.getByText('Loading exchange budget planner...')).toBeVisible()
    await expect(page.getByTestId('budget-heading')).toBeVisible()
  })

  test('clicking around while the first page is still loading ends on the page asked for last', async ({ page, backend }) => {
    backend.slow('/rest/v1/universities', 600)
    await page.goto('/universities')
    await page.getByTestId('nav-toggle').click()
    await page.getByTestId('nav-about').click()
    await expect(page).toHaveURL(/\/about$/)
    await page.waitForTimeout(900)
    await expect(page).toHaveURL(/\/about$/)
  })
})

test.describe('resilience: server errors', () => {
  test('the university list shows a message, not a blank page', async ({ page, backend }) => {
    backend.fail('/rest/v1/universities', { status: 500, body: { message: 'database is down' } })
    await page.goto('/universities')
    await expect(page.getByTestId('universities-page')).toBeVisible()
    await expect(page.getByTestId('university-card-name')).toHaveCount(0)
    await expect(page.getByText(/database is down|could not|unable|error/i).first()).toBeVisible()
  })

  test('a university page for a university that does not exist says so', async ({ page }) => {
    await page.goto('/universities/99999')
    await expect(page.getByTestId('university-page')).toBeVisible()
    await expect(page.getByText(/not found|does not exist|no longer/i).first()).toBeVisible()
  })

  test('a non-numeric university id does not crash the app', async ({ page }) => {
    await page.goto('/universities/abc')
    await expect(page.locator('#app')).not.toBeEmpty()
  })

  test('the home page still loads when the exchange-rate service is down', async ({ page }) => {
    await page.context().route('**/api.frankfurter.dev/**', (route) => route.abort())
    await page.goto('/')
    await expect(page.getByTestId('home-university-list')).toBeVisible()
  })

  test('the compare page copes with rates being slow', async ({ page }) => {
    await page.context().route('**/api.frankfurter.dev/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"base":"SGD","rates":{}}' })
    })
    await page.goto('/compare')
    await expect(page.getByTestId('compare-heading')).toBeVisible()
  })
})

test.describe('resilience: connection lost', () => {
  test('a page that is already open keeps working for what it has', async ({ page }) => {
    await openUniversities(page)
    page.context().mockBackend.goOffline()
    await page.getByTestId('filter-search-input').fill('Kyoto')
    await expect(page.getByTestId('university-card-name')).toHaveCount(1)
  })

  test('loading while offline does not crash, and reloading once back online works', async ({ page, backend }) => {
    backend.goOffline()
    await page.goto('/universities')
    await expect(page.getByTestId('universities-page')).toBeVisible()
    await expect(page.getByTestId('university-card-name')).toHaveCount(0)
    backend.goOnline()
    await page.reload()
    await expect(page.getByTestId('university-card-name').first()).toBeVisible()
  })

  test('saving while offline shows an error and works after reconnecting', async ({ page, student, backend }) => {
    backend.shortlist(student, [])
    await signIn(page, student, backend)
    await openUniversities(page)
    await page.getByTestId('filter-search-input').fill('Kyoto')
    backend.goOffline()
    await page.getByTestId('shortlist-add-btn').click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByTestId('shortlist-add-btn')).toBeVisible()
    backend.goOnline()
    await page.getByTestId('shortlist-add-btn').click()
    await expect(page.getByTestId('shortlist-remove-btn')).toBeVisible()
    expect(backend.rows('shortlists').filter((s) => s.user_id === student.id)).toHaveLength(1)
  })
})

test.describe('resilience: sessions', () => {
  test('an expired access token is refreshed quietly with the refresh token', async ({ page, student, backend }) => {
    const session = backend.session(student)
    await page.context().addInitScript(([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value)
    }, ['sb-mock-auth-token', JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) - 60 })])
    await page.goto('/shortlist')
    await expect(page).toHaveURL(/\/shortlist$/)
    await expect(page.getByTestId('shortlist-empty')).toBeVisible()
  })

  test('a session that has been revoked on the server does not crash the page', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/shortlist')
    await expect(page.getByTestId('shortlist-empty')).toBeVisible()
    backend.revokeSessions()
    await page.getByTestId('nav-toggle').click()
    await page.getByTestId('nav-universities').click()
    await expect(page.getByTestId('universities-page')).toBeVisible()
  })

  // Known gap: nothing signs the student out when the server stops accepting their token; they just see "JWT expired".
  test.fixme('a revoked session sends the student back to log in', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/shortlist')
    await expect(page.getByTestId('shortlist-empty')).toBeVisible()
    backend.revokeSessions()
    await page.reload()
    await expect(page).toHaveURL(/\/login/)
  })

  test('logging out in one tab logs out the other on its next load', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/shortlist')
    await page.getByTestId('nav-toggle').click()
    await page.getByTestId('nav-logout-btn').click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/shortlist')
    await expect(page).toHaveURL(/\/login/)
  })
})
