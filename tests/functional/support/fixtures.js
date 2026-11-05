// Every functional spec imports { test, expect } from here instead of from @playwright/test.
//
//   backend      the fake Supabase for this test (seed data, calls made, failures to inject)
//   student      a signed-up student, not signed in yet
//   admin        a staff account (app_metadata.role = admin), not signed in yet
//   person(user) opens a separate browser (its own cookies and storage) on the same backend,
//                signed in as `user` when one is given. Use it when two people are involved.
import { test as base, expect } from '@playwright/test'
import { MockBackend } from './backend.js'
import { signIn } from './ui.js'

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern -- Playwright needs the destructuring form even with no dependencies
  backend: async ({}, use) => {
    await use(new MockBackend())
  },

  context: async ({ context, backend }, use) => {
    await backend.attach(context)
    await use(context)
  },

  // an uncaught exception in the app is a bug, whatever the test was checking
  page: async ({ page }, use) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await use(page)
    expect(errors, 'uncaught errors in the page').toEqual([])
  },

  // the app must only talk to services the backend fakes
  strictNetwork: [
    async ({ backend }, use) => {
      await use()
      expect(backend.unhandled, 'requests the fake backend has no route for').toEqual([])
      expect(backend.blocked, 'requests to hosts the tests do not fake').toEqual([])
    },
    { auto: true },
  ],

  student: async ({ backend }, use) => {
    await use(backend.createUser({ email: 'student@test.dev' }))
  },

  admin: async ({ backend }, use) => {
    await use(backend.createAdmin({ email: 'admin@test.dev' }))
  },

  person: async ({ browser, baseURL, backend }, use) => {
    const contexts = []
    await use(async (user = null) => {
      const context = await browser.newContext({ baseURL })
      contexts.push(context)
      await backend.attach(context)
      const page = await context.newPage()
      if (user) await signIn(page, user, backend)
      return page
    })
    await Promise.all(contexts.map((context) => context.close()))
  },
})

export { expect }
