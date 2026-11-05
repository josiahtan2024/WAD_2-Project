// A stand-in for Supabase that lives inside the Playwright process. The app is the real
// built app talking to what looks like the real API (auth, PostgREST, storage), so the
// supabase-js client, the stores and the screens are all exercised; only Postgres is faked.
// One instance per test, shared by every browser context in that test, so two people (a
// student and an admin, say) can use the same "database" at once.
import { randomUUID } from 'node:crypto'
import { HAS_UPDATED_AT, TABLES, TABLE_NAMES } from './schema.js'
import { canDelete, canInsert, canUpdate } from './policies.js'
import { PostgrestError, runSelect, shapeRows } from './postgrest.js'
import { buildSeed, RATES } from './seed.js'

export const MOCK = {
  url: 'https://mock.supabase.co',
  anonKey: 'mock-anon-key',
  storageKey: 'sb-mock-auth-token', // where supabase-js keeps the session for this URL
}

// 1x1 transparent PNG, served for every logo, photo and map tile
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

// every column, so selecting from a table that is still empty does not look like a typo
const COLUMNS = {
  shortlists: ['id', 'user_id', 'university_id', 'created_at'],
  user_budgets: ['id', 'user_id', 'university_id', 'exchange_period_id', 'duration_months', 'currency_code', 'total_budget', 'accommodation_budget', 'food_budget', 'transport_budget', 'personal_budget', 'other_budget', 'housing_type', 'food_option', 'transport_option', 'created_at', 'updated_at'],
  timetables: ['id', 'user_id', 'university_id', 'exchange_period_id', 'created_at', 'updated_at'],
  cart_modules: ['id', 'user_id', 'university_id', 'university_module_id', 'created_at'],
  planned_modules: ['id', 'timetable_id', 'cart_module_id', 'user_id', 'university_id', 'section', 'day_of_week', 'start_time', 'end_time', 'location', 'session_type', 'created_at', 'updated_at'],
  university_reviews: ['id', 'user_id', 'university_id', 'exchange_period_id', 'rating', 'academics_rating', 'accommodation_rating', 'cost_rating', 'campus_rating', 'review', 'image_path', 'created_at', 'updated_at'],
  review_comments: ['id', 'review_id', 'user_id', 'body', 'created_at', 'updated_at'],
  university_costs: ['id', 'university_id', 'currency_code', 'accommodation', 'food', 'transport', 'personal_expenses', 'other_expenses', 'created_at', 'updated_at'],
}

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const now = () => new Date().toISOString()
const sameValue = (a, b, caseInsensitive) => (caseInsensitive ? String(a).toLowerCase() === String(b).toLowerCase() : String(a) === String(b))
const isBlank = (value) => value === null || value === undefined

class StorageError extends Error {
  constructor(status, statusCode, error, message) {
    super(message)
    this.status = status
    this.body = { statusCode: String(statusCode), error, message }
  }
}

export class MockBackend {
  constructor() {
    this.config = { emailConfirmation: false, minPasswordLength: 6 }
    this.requests = []
    this.blocked = []
    this.unhandled = []
    this.faults = []
    this.delays = []
    this.offline = false
    this.inflight = 0
    this.reset()
  }

  reset() {
    const seed = buildSeed()
    this.tables = Object.fromEntries(Object.entries(seed.tables).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]))
    this.users = seed.users.map((u) => ({ ...u, user_metadata: {}, created_at: '2026-01-01T00:00:00.000Z' }))
    this.sessions = new Map()
    this.refreshTokens = new Map()
    this.files = new Map()
    for (const university of this.tables.universities) {
      if (university.logo_url) this.files.set(university.logo_url, { contentType: 'image/webp', size: PIXEL.length })
    }
    this.counters = {}
    for (const name of TABLE_NAMES) this.counters[name] = Math.max(0, ...this.tables[name].map((r) => r.id ?? 0))
  }

  /* ---------- data access, used by the query engine and by tests ---------- */

  rows(table) {
    return this.tables[table]
  }

  columns(table) {
    const names = new Set(COLUMNS[table] ?? [])
    for (const row of this.tables[table] ?? []) for (const key of Object.keys(row)) names.add(key)
    return names
  }

  find(table, predicate) {
    return this.tables[table].find(predicate)
  }

  nextId(table) {
    this.counters[table] += 1
    return this.counters[table]
  }

  /** Put universities on a student's shortlist without going through the app (oldest first, so the last id is the newest). */
  shortlist(user, universityIds) {
    return universityIds.map((university_id) => {
      const row = { id: this.nextId('shortlists'), user_id: user.id, university_id, created_at: now() }
      this.tables.shortlists.push(row)
      return row
    })
  }

  /** Put courses (by module name) in a student's cart without going through the app. */
  fillCart(user, universityId, moduleNames = null) {
    const modules = this.tables.university_modules.filter(
      (m) => m.university_id === universityId && (!moduleNames || moduleNames.includes(m.module_name)),
    )
    return modules.map((m) => {
      const row = { id: this.nextId('cart_modules'), user_id: user.id, university_id: universityId, university_module_id: m.id, created_at: now() }
      this.tables.cart_modules.push(row)
      return row
    })
  }

  /** Make a review (or anything with created_at) look older, so "(edited)" and ordering can be tested without waiting. */
  backdate(table, predicate, milliseconds) {
    for (const row of this.tables[table].filter(predicate)) {
      row.created_at = new Date(Date.parse(row.created_at) - milliseconds).toISOString()
      if (row.updated_at) row.updated_at = new Date(Date.parse(row.updated_at) - milliseconds).toISOString()
    }
  }

  /* ---------- people ---------- */

  createUser({ email = `user-${randomUUID().slice(0, 8)}@test.dev`, password = 'correct-horse-1', role = null, confirmed = true } = {}) {
    const user = { id: randomUUID(), email, password, app_metadata: role ? { role } : {}, user_metadata: {}, confirmed, created_at: now() }
    this.users.push(user)
    return user
  }

  createAdmin(options = {}) {
    return this.createUser({ email: `admin-${randomUUID().slice(0, 8)}@test.dev`, ...options, role: 'admin' })
  }

  userByEmail(email) {
    return this.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())
  }

  publicUser(user) {
    return {
      id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email,
      email_confirmed_at: user.confirmed ? user.created_at : null, phone: '',
      confirmed_at: user.confirmed ? user.created_at : null, last_sign_in_at: now(),
      app_metadata: { provider: 'email', providers: ['email'], ...user.app_metadata },
      user_metadata: user.user_metadata ?? {},
      identities: [{ identity_id: user.id, id: user.id, user_id: user.id, provider: 'email', identity_data: { email: user.email, sub: user.id }, created_at: user.created_at }],
      created_at: user.created_at, updated_at: now(), is_anonymous: false,
    }
  }

  /** What supabase-js keeps in localStorage for a signed-in person. */
  session(user) {
    const issued = Math.floor(Date.now() / 1000)
    const expiresAt = issued + 3600
    const payload = { sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', app_metadata: user.app_metadata, iat: issued, exp: expiresAt }
    const accessToken = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.mock-signature-${randomUUID().slice(0, 6)}`
    const refreshToken = randomUUID()
    this.sessions.set(accessToken, { userId: user.id })
    this.refreshTokens.set(refreshToken, user.id)
    return { access_token: accessToken, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, refresh_token: refreshToken, user: this.publicUser(user) }
  }

  /** Every access token stops working, as if the sessions had been revoked. */
  revokeSessions() {
    this.sessions.clear()
  }

  identify(headers) {
    const token = (headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!token || token === MOCK.anonKey) return { userId: null, isAdmin: false, user: null }
    const session = this.sessions.get(token)
    const user = session && this.users.find((u) => u.id === session.userId)
    if (!user) throw new PostgrestError(401, 'PGRST301', 'JWT expired', null, null)
    return { userId: user.id, isAdmin: user.app_metadata?.role === 'admin', user }
  }

  /* ---------- failures, delays and call records ---------- */

  static matcher(match) {
    if (typeof match === 'function') return match
    if (match instanceof RegExp) return (req) => match.test(`${req.method} ${req.path}${req.search}`)
    const { method, path } = typeof match === 'string' ? { path: match } : match
    return (req) => (!method || req.method === method.toUpperCase()) && (!path || `${req.path}${req.search}`.includes(path))
  }

  /** Make matching requests fail. match: '/rest/v1/universities' | { method: 'POST', path } | RegExp | (req) => boolean */
  fail(match, { status = 500, body, times = Infinity } = {}) {
    this.faults.push({ test: MockBackend.matcher(match), status, body: body ?? { code: String(status), message: 'The mock backend was told to fail this request', details: null, hint: null }, remaining: times })
  }

  slow(match, milliseconds) {
    this.delays.push({ test: MockBackend.matcher(match), milliseconds })
  }

  goOffline() {
    this.offline = true
  }

  goOnline() {
    this.offline = false
  }

  clearFaults() {
    this.faults = []
    this.delays = []
    this.offline = false
  }

  /** Requests the app made, newest last. match as for fail(). */
  calls(match = () => true) {
    const test = MockBackend.matcher(match)
    return this.requests.filter(test)
  }

  /** Writes only (POST/PATCH/PUT/DELETE) against the data API, for "nothing was saved" assertions. */
  writes(table) {
    return this.requests.filter((r) => r.method !== 'GET' && r.path.startsWith(`/rest/v1/${table ?? ''}`))
  }

  /* ---------- wiring into a browser context ---------- */

  /** Resolves once the app has stopped talking to the backend for a moment (nothing in flight). */
  async whenIdle(quietFor = 80) {
    let quietSince = Date.now()
    let seen = this.requests.length
    while (Date.now() - quietSince < quietFor) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      if (this.inflight > 0 || this.requests.length !== seen) {
        seen = this.requests.length
        quietSince = Date.now()
      }
    }
  }

  async attach(context) {
    context.mockBackend = this
    // anything that is not the app or a service we fake is refused, so tests never touch the internet
    await context.route('**/*', (route) => {
      const { hostname, href } = new URL(route.request().url())
      if (['localhost', '127.0.0.1'].includes(hostname) || href.startsWith('data:') || href.startsWith('blob:')) return route.fallback()
      this.blocked.push(href)
      return route.abort('blockedbyclient')
    })
    await context.route('https://mock.supabase.co/**', (route) => this.handle(route))
    await context.route('https://api.frankfurter.dev/**', (route) => this.frankfurter(route))
    await context.route('https://*.tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }))
    await context.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }))
  }

  cors(request) {
    return {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? 'authorization, apikey, content-type',
      'access-control-expose-headers': 'content-range, content-length',
    }
  }

  async frankfurter(route) {
    const url = new URL(route.request().url())
    const cors = { 'access-control-allow-origin': '*' }
    if (this.offline) return route.abort('connectionfailed')
    const fault = this.faults.find((f) => f.remaining > 0 && f.test({ method: 'GET', path: url.pathname, search: url.search }))
    if (fault) {
      fault.remaining -= 1
      return route.fulfill({ status: fault.status, headers: cors, contentType: 'application/json', body: JSON.stringify(fault.body) })
    }
    this.requests.push({ method: 'GET', path: url.pathname, search: url.search, host: url.hostname })
    if (url.pathname === '/v2/rates') {
      const rates = Object.entries(RATES).map(([quote, rate]) => ({ date: '2026-11-03', base: 'SGD', quote, rate }))
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(rates) })
    }
    if (url.pathname === '/v1/latest') {
      const symbols = (url.searchParams.get('symbols') ?? '').split(',').filter(Boolean)
      const rates = Object.fromEntries(symbols.filter((s) => RATES[s]).map((s) => [s, RATES[s]]))
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ amount: 1, base: 'SGD', date: '2026-11-03', rates }) })
    }
    this.unhandled.push(`${url.pathname}${url.search}`)
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{}' })
  }

  /* ---------- the request pipeline ---------- */

  async handle(route) {
    this.inflight += 1
    try {
      await this.process(route)
    } finally {
      this.inflight -= 1
    }
  }

  async process(route) {
    const request = route.request()
    const url = new URL(request.url())
    const cors = this.cors(request)
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })

    const req = { method: request.method(), path: url.pathname, search: url.search, params: url.searchParams, headers: request.headers(), body: undefined, raw: null }
    const text = request.postData()
    req.raw = request.postDataBuffer()
    if (text) {
      try {
        req.body = JSON.parse(text)
      } catch {
        req.body = undefined
      }
    }
    this.requests.push({ method: req.method, path: req.path, search: req.search, body: req.body, host: url.hostname })

    if (this.offline) return route.abort('connectionfailed')
    const wait = this.delays.filter((d) => d.test(req)).reduce((total, d) => total + d.milliseconds, 0)
    const fault = this.faults.find((f) => f.remaining > 0 && f.test(req))
    if (fault) {
      fault.remaining -= 1
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
      return route.fulfill({ status: fault.status, headers: cors, contentType: 'application/json', body: JSON.stringify(fault.body) })
    }

    // The server works on the data as it is when the request arrives; a slow network only
    // delays the answer. That is what makes a late response "stale".
    let result
    try {
      result = await this.dispatch(req)
    } catch (error) {
      if (!(error instanceof PostgrestError) && !(error instanceof StorageError)) throw error
      result = { status: error.status, body: error.body }
    }
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    const headers = { ...cors, ...(result.headers ?? {}) }
    if (result.binary) return route.fulfill({ status: result.status, headers, contentType: result.contentType, body: result.binary })
    if (result.body === undefined) return route.fulfill({ status: result.status, headers })
    return route.fulfill({ status: result.status, headers, contentType: 'application/json; charset=utf-8', body: JSON.stringify(result.body) })
  }

  dispatch(req) {
    if (req.path.startsWith('/rest/v1/')) return this.rest(req)
    if (req.path.startsWith('/auth/v1/')) return this.auth(req)
    if (req.path.startsWith('/storage/v1/')) return this.storage(req)
    this.unhandled.push(`${req.method} ${req.path}`)
    return { status: 404, body: { message: `The mock backend has no route for ${req.path}` } }
  }

  /* ---------- data API ---------- */

  rest(req) {
    const name = req.path.slice('/rest/v1/'.length)
    const ctx = this.identify(req.headers)
    if (name.startsWith('rpc/')) return this.rpc(name.slice(4), req.body, ctx)
    if (!TABLES[name]) throw new PostgrestError(404, 'PGRST205', `Could not find the table 'public.${name}' in the schema cache`)

    const wantsObject = (req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')
    const prefer = req.headers.prefer ?? ''
    const representation = prefer.includes('return=representation')

    if (req.method === 'GET' || req.method === 'HEAD') {
      const data = runSelect(this, name, req.params, ctx, { single: wantsObject })
      return { status: 200, body: data, headers: { 'content-range': Array.isArray(data) ? (data.length ? `0-${data.length - 1}/*` : '*/0') : '0-0/*' } }
    }
    let written
    if (req.method === 'POST') {
      const inputs = Array.isArray(req.body) ? req.body : [req.body]
      written = prefer.includes('resolution=merge-duplicates')
        ? this.upsert(name, inputs, req.params.get('on_conflict'), ctx)
        : this.insert(name, inputs, ctx)
      return this.respondWrite(name, written, req, 201, representation, wantsObject, ctx)
    }
    if (req.method === 'PATCH') {
      written = this.update(name, req.body ?? {}, req.params, ctx, wantsObject)
      return this.respondWrite(name, written, req, representation ? 200 : 204, representation, wantsObject, ctx)
    }
    if (req.method === 'DELETE') {
      written = this.remove(name, req.params, ctx, wantsObject)
      return this.respondWrite(name, written, req, representation ? 200 : 204, representation, wantsObject, ctx)
    }
    throw new PostgrestError(405, 'PGRST117', `Unsupported HTTP method: ${req.method}`)
  }

  respondWrite(table, rows, req, status, representation, wantsObject, ctx) {
    if (!representation) return { status }
    const shaped = shapeRows(this, table, rows, req.params, ctx)
    if (wantsObject) {
      if (shaped.length !== 1) throw new PostgrestError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${shaped.length} rows`)
      return { status, body: shaped[0] }
    }
    return { status, body: shaped }
  }

  toNumber(table, column, value) {
    if (isBlank(value)) return null
    const number = Number(value)
    if (typeof value === 'string' && (value.trim() === '' || Number.isNaN(number))) {
      throw new PostgrestError(400, '22P02', `invalid input syntax for type numeric: "${value}"`)
    }
    if (Number.isNaN(number)) throw new PostgrestError(400, '22P02', `invalid input syntax for type numeric: "${value}"`)
    return number
  }

  normalize(table, input, withDefaults = true) {
    const definition = TABLES[table]
    const row = { ...(withDefaults ? definition.defaults ?? {} : {}), ...input }
    // foreign keys to bigint ids arrive as text when the app takes them from the URL ("7"); Postgres casts them
    const idColumns = (definition.fks ?? []).filter((fk) => fk.table !== 'auth.users').map((fk) => fk.column)
    for (const column of [...(definition.int ?? []), ...(definition.num ?? []), ...idColumns]) {
      if (column in row) row[column] = this.toNumber(table, column, row[column])
    }
    return row
  }

  assertValid(table, row, ignore) {
    const definition = TABLES[table]
    for (const column of definition.required ?? []) {
      if (isBlank(row[column])) throw new PostgrestError(400, '23502', `null value in column "${column}" of relation "${table}" violates not-null constraint`)
    }
    for (const [name, passes] of definition.checks ?? []) {
      if (!passes(row)) throw new PostgrestError(400, '23514', `new row for relation "${table}" violates check constraint "${name}"`)
    }
    for (const unique of definition.unique ?? []) {
      if (unique.columns.some((c) => isBlank(row[c]))) continue
      const clash = this.tables[table].find((other) => other !== ignore && unique.columns.every((c) => sameValue(other[c], row[c], unique.caseInsensitive)))
      if (clash) throw new PostgrestError(409, '23505', `duplicate key value violates unique constraint "${unique.name}"`, `Key (${unique.columns.join(', ')})=(${unique.columns.map((c) => row[c]).join(', ')}) already exists.`)
    }
    for (const fk of definition.fks ?? []) {
      const value = row[fk.column]
      if (isBlank(value)) continue
      const exists = fk.table === 'auth.users' ? this.users.some((u) => u.id === value) : this.tables[fk.table].some((r) => r.id === Number(value))
      if (!exists) throw new PostgrestError(409, '23503', `insert or update on table "${table}" violates foreign key constraint "${table}_${fk.column}_fkey"`)
    }
  }

  insert(table, inputs, ctx) {
    const added = []
    for (const input of inputs) {
      const row = this.normalize(table, input)
      row.id ??= this.nextId(table)
      row.created_at ??= now()
      if (HAS_UPDATED_AT.has(table)) row.updated_at ??= now()
      if (!canInsert(this, table, row, ctx)) throw new PostgrestError(403, '42501', `new row violates row-level security policy for table "${table}"`)
      this.assertValid(table, row)
      this.tables[table].push(row)
      added.push(row)
    }
    return added
  }

  upsert(table, inputs, onConflict, ctx) {
    const columns = (onConflict ?? 'id').split(',')
    const result = []
    for (const input of inputs) {
      const row = this.normalize(table, input, false)
      const existing = this.tables[table].find((r) => columns.every((c) => !isBlank(row[c]) && sameValue(r[c], row[c])))
      if (!existing) {
        result.push(...this.insert(table, [input], ctx))
        continue
      }
      const next = { ...existing, ...row, id: existing.id, created_at: existing.created_at }
      if (!canUpdate(this, table, existing, existing, ctx)) throw new PostgrestError(403, '42501', `new row violates row-level security policy for table "${table}"`)
      if (!canUpdate(this, table, existing, next, ctx)) throw new PostgrestError(403, '42501', `new row violates row-level security policy for table "${table}"`)
      if (HAS_UPDATED_AT.has(table)) next.updated_at = now()
      this.assertValid(table, next, existing)
      Object.assign(existing, next)
      result.push(existing)
    }
    return result
  }

  filtered(table, params, ctx) {
    // reuse the query engine's filters by running a select, then map back to the stored rows
    const shaped = runSelect(this, table, new URLSearchParams([...params.entries()].filter(([k]) => k !== 'select')), ctx)
    return shaped.map((s) => this.tables[table].find((r) => r.id === s.id))
  }

  update(table, changes, params, ctx, wantsObject) {
    const targets = this.filtered(table, params, ctx).filter((row) => canUpdate(this, table, row, row, ctx))
    if (wantsObject && targets.length !== 1) throw new PostgrestError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${targets.length} rows`)
    const patch = this.normalize(table, changes, false)
    const updates = targets.map((row) => {
      const next = { ...row, ...patch, id: row.id }
      if (!canUpdate(this, table, row, next, ctx)) throw new PostgrestError(403, '42501', `new row violates row-level security policy for table "${table}"`)
      if (HAS_UPDATED_AT.has(table)) next.updated_at = now() // a trigger owns updated_at, whatever the browser sent
      this.assertValid(table, next, row)
      return [row, next]
    })
    for (const [row, next] of updates) Object.assign(row, next)
    return updates.map(([row]) => row)
  }

  remove(table, params, ctx, wantsObject) {
    const targets = this.filtered(table, params, ctx).filter((row) => canDelete(this, table, row, ctx))
    if (wantsObject && targets.length !== 1) throw new PostgrestError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${targets.length} rows`)
    for (const row of targets) this.cascade(table, row)
    return targets
  }

  /** Delete a row and whatever the foreign keys say should go with it. */
  cascade(table, row) {
    for (const other of TABLE_NAMES) {
      for (const fk of TABLES[other].fks ?? []) {
        if (fk.table !== table) continue
        const dependants = this.tables[other].filter((r) => r[fk.column] === row.id)
        for (const dependant of dependants) {
          if (fk.onDelete === 'cascade') this.cascade(other, dependant)
          else if (fk.onDelete === 'setnull') dependant[fk.column] = null
          else throw new PostgrestError(409, '23503', `update or delete on table "${table}" violates foreign key constraint on table "${other}"`)
        }
      }
    }
    this.tables[table] = this.tables[table].filter((r) => r !== row)
  }

  deleteUser(user) {
    for (const other of TABLE_NAMES) {
      for (const fk of TABLES[other].fks ?? []) {
        if (fk.table === 'auth.users') for (const row of this.tables[other].filter((r) => r[fk.column] === user.id)) this.cascade(other, row)
      }
    }
    this.users = this.users.filter((u) => u !== user)
  }

  rpc(name, body, ctx) {
    if (name !== 'university_impact') throw new PostgrestError(404, 'PGRST202', `Could not find the function public.${name} in the schema cache`)
    if (!ctx.isAdmin) throw new PostgrestError(403, '42501', 'Only admins can do that')
    const id = Number(body.p_university_id)
    const count = (table) => this.tables[table].filter((r) => r.university_id === id).length
    return { status: 200, body: { shortlists: count('shortlists'), budgets: count('user_budgets'), reviews: count('university_reviews'), timetables: count('timetables') } }
  }

  /* ---------- auth ---------- */

  authError(status, errorCode, message) {
    return { status, body: { code: status, error_code: errorCode, msg: message } }
  }

  auth(req) {
    const route = req.path.slice('/auth/v1/'.length)
    const grant = req.params.get('grant_type')

    if (route === 'settings') return { status: 200, body: { external: { email: true }, disable_signup: false, mailer_autoconfirm: !this.config.emailConfirmation } }

    if (route === 'token' && grant === 'password') {
      const { email, password } = req.body ?? {}
      const user = this.userByEmail(email)
      if (!user || user.password !== password) return this.authError(400, 'invalid_credentials', 'Invalid login credentials')
      if (this.config.emailConfirmation && !user.confirmed) return this.authError(400, 'email_not_confirmed', 'Email not confirmed')
      return { status: 200, body: this.session(user) }
    }

    if (route === 'token' && grant === 'refresh_token') {
      const userId = this.refreshTokens.get(req.body?.refresh_token)
      const user = this.users.find((u) => u.id === userId)
      if (!user) return this.authError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found')
      return { status: 200, body: this.session(user) }
    }

    if (route === 'signup') {
      const { email, password } = req.body ?? {}
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? '')) return this.authError(400, 'validation_failed', `Unable to validate email address: invalid format`)
      if (String(password ?? '').length < this.config.minPasswordLength) {
        return { status: 422, body: { code: 422, error_code: 'weak_password', msg: `Password should be at least ${this.config.minPasswordLength} characters.`, weak_password: { reasons: ['length'] } } }
      }
      if (this.userByEmail(email)) {
        if (this.config.emailConfirmation) return { status: 200, body: { ...this.publicUser({ id: randomUUID(), email, app_metadata: {}, confirmed: false, created_at: now() }), identities: [] } }
        return this.authError(422, 'user_already_exists', 'User already registered')
      }
      const user = this.createUser({ email, password, confirmed: !this.config.emailConfirmation })
      if (this.config.emailConfirmation) return { status: 200, body: { ...this.publicUser(user), confirmation_sent_at: now() } }
      return { status: 200, body: this.session(user) }
    }

    if (route === 'logout') {
      const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
      this.sessions.delete(token)
      return { status: 204 }
    }

    if (route === 'user') {
      const ctx = this.identify(req.headers)
      if (!ctx.user) return this.authError(401, 'bad_jwt', 'Auth session missing!')
      return { status: 200, body: this.publicUser(ctx.user) }
    }

    this.unhandled.push(`${req.method} ${req.path}`)
    return this.authError(404, 'not_found', `The mock backend has no auth route for ${route}`)
  }

  /* ---------- storage ---------- */

  storage(req) {
    const path = decodeURIComponent(req.path.slice('/storage/v1/object/'.length))

    if (req.method === 'GET' && path.startsWith('public/')) {
      const key = path.slice('public/'.length)
      if (!this.files.has(key)) throw new StorageError(404, 404, 'not_found', 'Object not found')
      return { status: 200, binary: PIXEL, contentType: 'image/png', headers: { 'cache-control': 'no-store' } }
    }

    const ctx = this.identify(req.headers)
    const slash = path.indexOf('/')
    const bucket = slash === -1 ? path : path.slice(0, slash)
    const objectPath = slash === -1 ? '' : path.slice(slash + 1)

    if (req.method === 'POST') {
      const allowed = bucket === 'university-logos' ? ctx.isAdmin : bucket === 'review-images' && !!ctx.userId && objectPath.split('/').length > 1 && objectPath.split('/')[0] === ctx.userId
      if (!allowed) throw new StorageError(400, 403, 'Unauthorized', 'new row violates row-level security policy')
      const file = this.readUpload(req)
      if (!ALLOWED_IMAGES.includes(file.contentType)) throw new StorageError(415, 415, 'invalid_mime_type', `mime type ${file.contentType} is not supported`)
      if (file.size > MAX_IMAGE_BYTES) throw new StorageError(413, 413, 'Payload too large', 'The object exceeded the maximum allowed size')
      const key = `${bucket}/${objectPath}`
      if (this.files.has(key)) throw new StorageError(400, 409, 'Duplicate', 'The resource already exists')
      this.files.set(key, file)
      return { status: 200, body: { Id: randomUUID(), Key: key } }
    }

    if (req.method === 'DELETE') {
      const removed = []
      for (const prefix of req.body?.prefixes ?? []) {
        const key = `${bucket}/${prefix}`
        const mine = bucket === 'review-images' && !!ctx.userId && prefix.split('/')[0] === ctx.userId
        if (this.files.has(key) && (ctx.isAdmin || mine)) {
          this.files.delete(key)
          removed.push({ name: prefix, bucket_id: bucket })
        }
      }
      return { status: 200, body: removed }
    }

    this.unhandled.push(`${req.method} ${req.path}`)
    return { status: 404, body: { message: `The mock backend has no storage route for ${req.method} ${req.path}` } }
  }

  /** Reads the content type and size of the file in a multipart upload (or a raw body). */
  readUpload(req) {
    const type = req.headers['content-type'] ?? ''
    const boundary = /boundary=(.+)$/.exec(type)?.[1]
    if (!boundary) return { contentType: type.split(';')[0], size: req.raw?.length ?? 0 }
    const text = req.raw.toString('latin1')
    const headerEnd = text.indexOf('\r\n\r\n', text.indexOf('filename='))
    const contentType = /Content-Type:\s*([^\r\n]+)/i.exec(text.slice(text.indexOf('filename='), headerEnd))?.[1]?.trim() ?? 'application/octet-stream'
    const start = headerEnd + 4
    const end = text.lastIndexOf(`\r\n--${boundary}`)
    return { contentType, size: Math.max(0, end - start) }
  }
}
