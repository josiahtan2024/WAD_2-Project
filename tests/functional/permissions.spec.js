import { test, expect } from './support/fixtures.js'
import { signIn, openMenu, nav } from './support/ui.js'

const API = { key: 'sb-mock-auth-token', url: 'https://mock.supabase.co', anon: 'mock-anon-key' }

/** Calls the data API with the signed-in tab's own token, the way a curious student could from the console. */
function callApi(page, { method = 'GET', path, body, headers = {} }) {
  return page.evaluate(
    async ({ api, method, path, body, headers }) => {
      const session = JSON.parse(localStorage.getItem(api.key) ?? 'null')
      const token = session?.access_token ?? api.anon
      const response = await fetch(`${api.url}${path}`, {
        method,
        headers: { apikey: api.anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await response.text()
      return { status: response.status, body: text ? JSON.parse(text) : null }
    },
    { api: API, method, path, body, headers },
  )
}

const row = (extra) => ({ created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra })

test.describe('permissions: one student cannot touch another\'s data', () => {
  let other

  test.beforeEach(async ({ page, student, backend }) => {
    other = backend.createUser()
    backend.shortlist(other, [5])
    backend.fillCart(other, 2, ['Game Theory'])
    backend.rows('user_budgets').push(row({ id: 70, user_id: other.id, university_id: 2, duration_months: 4, currency_code: 'USD', total_budget: 1, accommodation_budget: 1 }))
    backend.rows('timetables').push(row({ id: 70, user_id: other.id, university_id: 2, exchange_period_id: 3 }))
    await signIn(page, student, backend)
    await page.goto('/')
  })

  for (const table of ['shortlists', 'cart_modules', 'user_budgets', 'timetables']) {
    test(`cannot read their ${table}`, async ({ page }) => {
      const { status, body } = await callApi(page, { path: `/rest/v1/${table}?select=*` })
      expect(status).toBe(200)
      expect(body).toEqual([])
    })
  }

  test('cannot delete their rows', async ({ page, backend }) => {
    for (const table of ['shortlists', 'cart_modules', 'user_budgets', 'timetables']) {
      const { body } = await callApi(page, { method: 'DELETE', path: `/rest/v1/${table}?user_id=eq.${other.id}` })
      expect(body).toEqual([])
      expect(backend.rows(table).filter((r) => r.user_id === other.id)).toHaveLength(1)
    }
  })

  test('cannot change their budget', async ({ page, backend }) => {
    const { body } = await callApi(page, { method: 'PATCH', path: '/rest/v1/user_budgets?id=eq.70', body: { total_budget: 999999 } })
    expect(body).toEqual([])
    expect(backend.find('user_budgets', (b) => b.id === 70).total_budget).toBe(1)
  })

  test('cannot add rows in their name', async ({ page, backend }) => {
    const shortlist = await callApi(page, { method: 'POST', path: '/rest/v1/shortlists', body: { user_id: other.id, university_id: 3 } })
    expect(shortlist.status).toBe(403)
    const review = await callApi(page, { method: 'POST', path: '/rest/v1/university_reviews', body: { user_id: other.id, university_id: 3, rating: 5, review: 'forged' } })
    expect(review.status).toBe(403)
    const comment = await callApi(page, { method: 'POST', path: '/rest/v1/review_comments', body: { user_id: other.id, review_id: 1, body: 'forged' } })
    expect(comment.status).toBe(403)
    expect(backend.rows('shortlists').filter((s) => s.user_id === other.id)).toHaveLength(1)
    expect(backend.rows('review_comments').filter((c) => c.body === 'forged')).toHaveLength(0)
  })

  test('cannot edit or delete another student\'s review or comment', async ({ page, backend }) => {
    const edit = await callApi(page, { method: 'PATCH', path: '/rest/v1/university_reviews?id=eq.1', body: { review: 'hacked' } })
    const remove = await callApi(page, { method: 'DELETE', path: '/rest/v1/university_reviews?id=eq.2' })
    const comment = await callApi(page, { method: 'DELETE', path: '/rest/v1/review_comments?id=eq.1' })
    expect([edit.body, remove.body, comment.body]).toEqual([[], [], []])
    expect(backend.rows('university_reviews')).toHaveLength(2)
    expect(backend.rows('review_comments')).toHaveLength(1)
  })

  test('cannot upload a photo into another student\'s folder', async ({ page }) => {
    const outcome = await page.evaluate(async ({ api, folder }) => {
      const session = JSON.parse(localStorage.getItem(api.key))
      const form = new FormData()
      form.append('', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'x.png')
      const response = await fetch(`${api.url}/storage/v1/object/review-images/${folder}/x.png`, {
        method: 'POST',
        headers: { apikey: api.anon, Authorization: `Bearer ${session.access_token}` },
        body: form,
      })
      return response.status
    }, { api: API, folder: other.id })
    expect([400, 401, 403]).toContain(outcome)
  })

  test('cannot upload a university logo', async ({ page }) => {
    const outcome = await page.evaluate(async (api) => {
      const session = JSON.parse(localStorage.getItem(api.key))
      const form = new FormData()
      form.append('', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'x.png')
      const response = await fetch(`${api.url}/storage/v1/object/university-logos/evil.png`, {
        method: 'POST',
        headers: { apikey: api.anon, Authorization: `Bearer ${session.access_token}` },
        body: form,
      })
      return response.status
    }, API)
    expect([400, 401, 403]).toContain(outcome)
  })

  test('cannot call the staff-only impact report', async ({ page }) => {
    const { status } = await callApi(page, { method: 'POST', path: '/rest/v1/rpc/university_impact', body: { p_university_id: 15 } })
    expect(status).toBeGreaterThanOrEqual(400)
  })
})

test.describe('permissions: visitors who are not logged in', () => {
  test('can read public data but write nothing', async ({ page }) => {
    await page.goto('/')
    const read = await callApi(page, { path: '/rest/v1/universities?select=id&order=id' })
    expect(read.status).toBe(200)
    expect(read.body).toHaveLength(14)
    expect(read.body.map((u) => u.id)).not.toContain(15)

    const write = await callApi(page, { method: 'POST', path: '/rest/v1/universities', body: { name: 'Anon U', country: 'X', region: 'Y' } })
    expect(write.status).toBeGreaterThanOrEqual(401)
    const review = await callApi(page, { method: 'POST', path: '/rest/v1/university_reviews', body: { university_id: 3, rating: 5, review: 'anon' } })
    expect(review.status).toBeGreaterThanOrEqual(401)
  })

  test('cannot see anyone\'s private tables', async ({ page, backend }) => {
    backend.shortlist(backend.createUser(), [5])
    await page.goto('/')
    for (const table of ['shortlists', 'cart_modules', 'user_budgets', 'timetables', 'planned_modules']) {
      const { body } = await callApi(page, { path: `/rest/v1/${table}?select=*` })
      expect(body).toEqual([])
    }
  })

  test('can read reviews and comments', async ({ page }) => {
    await page.goto('/')
    const reviews = await callApi(page, { path: '/rest/v1/university_reviews?select=id' })
    const comments = await callApi(page, { path: '/rest/v1/review_comments?select=id' })
    expect(reviews.body).toHaveLength(2)
    expect(comments.body).toHaveLength(1)
  })
})

test.describe('permissions: the staff role', () => {
  test('a role set in the user\'s own metadata does not make them staff', async ({ page, backend }) => {
    const sneaky = backend.createUser()
    sneaky.user_metadata = { role: 'admin' }
    await signIn(page, sneaky, backend)
    await page.goto('/universities')
    await expect(page.getByTestId('admin-add-university')).toHaveCount(0)
    await openMenu(page)
    await expect(nav(page, 'nav-staff-badge')).toHaveCount(0)
    const { body } = await callApi(page, { method: 'PATCH', path: '/rest/v1/universities?id=eq.2', body: { name: 'Mine now' } })
    expect(body).toEqual([])
  })

  test('only an admin sees hidden universities through the API', async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await page.goto('/')
    const { body } = await callApi(page, { path: '/rest/v1/universities?select=id&order=id' })
    expect(body.map((u) => u.id)).toContain(15)
  })

  test('an admin can read and moderate everything but still not impersonate a student', async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await page.goto('/')
    const forged = await callApi(page, { method: 'POST', path: '/rest/v1/shortlists', body: { user_id: backend.userByEmail('alex@seed.test').id, university_id: 3 } })
    expect(forged.status).toBeGreaterThanOrEqual(401)
    const remove = await callApi(page, { method: 'DELETE', path: '/rest/v1/university_reviews?id=eq.1' })
    expect(remove.body).toHaveLength(1)
  })

  test('the role is checked on the server each time, not remembered by the page', async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await page.goto('/universities')
    await expect(page.getByTestId('admin-add-university')).toBeVisible()
    admin.app_metadata = {} // demoted while the page is still open
    const { body } = await callApi(page, { method: 'PATCH', path: '/rest/v1/universities?id=eq.2', body: { name: 'Still staff?' } })
    expect(body).toEqual([])
    expect(backend.find('universities', (u) => u.id === 2).name).toBe('Boston University')
  })
})
