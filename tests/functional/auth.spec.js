import { test, expect } from './support/fixtures.js'
import { loginWithForm, openMenu, openUniversities } from './support/ui.js'
import { MOCK } from './support/backend.js'

const storedSession = (page) => page.evaluate((key) => localStorage.getItem(key), MOCK.storageKey)

test.describe('logging in', () => {
  test('a student can log in and lands on the home page', async ({ page, student }) => {
    await loginWithForm(page, student.email, student.password)
    await expect(page.getByTestId('home-page')).toBeVisible()
    await openMenu(page)
    await expect(page.getByTestId('nav-logout-btn')).toBeVisible()
    await expect(page.getByTestId('nav-login-link')).toHaveCount(0)
    await expect(page.getByTestId('nav-signup-link')).toHaveCount(0)
  })

  test('the session is kept in the browser, so a reload keeps you logged in', async ({ page, student }) => {
    await loginWithForm(page, student.email, student.password)
    await expect(page.getByTestId('home-page')).toBeVisible()
    expect(await storedSession(page)).toContain(student.email)
    await page.reload()
    await page.goto('/shortlist')
    await expect(page.getByTestId('shortlist-page')).toBeVisible()
  })

  test('the email is trimmed and not case sensitive', async ({ page, student }) => {
    await loginWithForm(page, `  ${student.email.toUpperCase()}  `, student.password)
    await expect(page.getByTestId('home-page')).toBeVisible()
    await openMenu(page)
    await expect(page.getByTestId('nav-logout-btn')).toBeVisible()
  })

  test('a wrong password is refused with a clear message and nothing is stored', async ({ page, student }) => {
    await loginWithForm(page, student.email, 'not-the-password')
    await expect(page.getByTestId('login-error')).toHaveText('Invalid login credentials')
    await expect(page.getByTestId('login-page')).toBeVisible()
    expect(await storedSession(page)).toBeNull()
  })

  test('an unknown email gets the same message, so accounts cannot be guessed', async ({ page }) => {
    await loginWithForm(page, 'nobody@test.dev', 'whatever-123')
    await expect(page.getByTestId('login-error')).toHaveText('Invalid login credentials')
  })

  test('the form cannot be submitted empty or with a malformed email', async ({ page, backend }) => {
    await page.goto('/login')
    await page.getByTestId('login-submit-btn').click()
    await page.getByTestId('login-email-input').fill('not-an-email')
    await page.getByTestId('login-password-input').fill('secret-123')
    await page.getByTestId('login-submit-btn').click()
    expect(backend.calls('/auth/v1/token')).toHaveLength(0)
    await expect(page.getByTestId('login-page')).toBeVisible()
  })

  test('the button is disabled while the login is in flight, so it cannot be sent twice', async ({ page, student, backend }) => {
    backend.slow('/auth/v1/token', 600)
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(student.email)
    await page.getByTestId('login-password-input').fill(student.password)
    await page.getByTestId('login-submit-btn').click()
    await expect(page.getByTestId('login-submit-btn')).toBeDisabled()
    await expect(page.getByTestId('login-submit-btn')).toContainText('Logging')
    await expect(page.getByTestId('home-page')).toBeVisible()
    expect(backend.calls('/auth/v1/token')).toHaveLength(1)
  })

  test('the error goes away once the next attempt works', async ({ page, student }) => {
    await loginWithForm(page, student.email, 'wrong-wrong')
    await expect(page.getByTestId('login-error')).toBeVisible()
    await page.getByTestId('login-password-input').fill(student.password)
    await page.getByTestId('login-submit-btn').click()
    await expect(page.getByTestId('home-page')).toBeVisible()
  })

  test('a failing auth service shows an error and lets the student try again', async ({ page, student, backend }) => {
    backend.fail('/auth/v1/token', { status: 500, body: { code: 500, msg: 'Service unavailable' } })
    await loginWithForm(page, student.email, student.password)
    await expect(page.getByTestId('login-error')).toBeVisible()
    await expect(page.getByTestId('login-submit-btn')).toBeEnabled()
    backend.clearFaults()
    await page.getByTestId('login-submit-btn').click()
    await expect(page.getByTestId('home-page')).toBeVisible()
  })

  test.fixme('the error for an outage is readable', async ({ page, student, backend }) => {
    // Known gap: when the auth service fails the page shows the raw text "{}" because the
    // client cannot read the error body and the form prints whatever message it is given.
    backend.fail('/auth/v1/token', { status: 500, body: { code: 500, msg: 'Service unavailable' } })
    await loginWithForm(page, student.email, student.password)
    await expect(page.getByTestId('login-error')).not.toHaveText('{}')
  })
})

test.describe('protected pages', () => {
  for (const [path, page_] of [['/shortlist', 'shortlist-page'], ['/cost-estimator', 'budget-heading'], ['/schedule', 'schedule-page']]) {
    test(`${path} sends a visitor to the login page and brings them back after login`, async ({ page, student }) => {
      await page.goto(path)
      await expect(page.getByTestId('login-page')).toBeVisible()
      expect(new URL(page.url()).searchParams.get('redirect')).toBe(path)
      await page.getByTestId('login-email-input').fill(student.email)
      await page.getByTestId('login-password-input').fill(student.password)
      await page.getByTestId('login-submit-btn').click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByTestId(page_)).toBeVisible()
    })
  }

  for (const path of ['/', '/about', '/universities', '/universities/2', '/compare', '/courses']) {
    test(`${path} is open to visitors`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path}$`))
      await expect(page.getByTestId('login-page')).toHaveCount(0)
    })
  }

  test('the menu does not offer shortlist, budget or schedule to a visitor', async ({ page }) => {
    await page.goto('/')
    await openMenu(page)
    for (const id of ['nav-shortlist', 'nav-cost-estimator', 'nav-schedule']) await expect(page.getByTestId(id)).toHaveCount(0)
    await expect(page.getByTestId('nav-login-link')).toBeVisible()
    await expect(page.getByTestId('nav-signup-link')).toBeVisible()
  })
})

test.describe('logging out', () => {
  test('logging out clears the session and locks the protected pages again', async ({ page, student, backend }) => {
    await loginWithForm(page, student.email, student.password)
    await expect(page.getByTestId('home-page')).toBeVisible()
    await openMenu(page)
    await page.getByTestId('nav-logout-btn').click()
    await expect(page.getByTestId('login-page')).toBeVisible()
    expect(await storedSession(page)).toBeNull()
    expect(backend.calls('/auth/v1/logout')).toHaveLength(1)
    await page.goto('/shortlist')
    await expect(page.getByTestId('login-page')).toBeVisible()
  })

  test('after a reload you are still logged out', async ({ page, student }) => {
    await loginWithForm(page, student.email, student.password)
    await expect(page.getByTestId('home-page')).toBeVisible()
    await openMenu(page)
    await page.getByTestId('nav-logout-btn').click()
    await expect(page.getByTestId('login-page')).toBeVisible()
    await page.reload()
    await openMenu(page)
    await expect(page.getByTestId('nav-login-link')).toBeVisible()
  })

  test('logging out one tab does not leave data of the previous person on screen', async ({ page, student, backend }) => {
    const other = backend.createUser({ email: 'second@test.dev' })
    await loginWithForm(page, student.email, student.password)
    await openUniversities(page)
    await page.getByTestId('university-card').first().getByTestId('shortlist-add-btn').click()
    await expect(page.getByTestId('university-card').first().getByTestId('shortlist-remove-btn')).toBeVisible()
    await openMenu(page)
    await page.getByTestId('nav-logout-btn').click()
    await loginWithForm(page, other.email, other.password)
    await openUniversities(page)
    await expect(page.getByTestId('university-card').first().getByTestId('shortlist-add-btn')).toBeVisible()
  })
})

test.describe('signing up', () => {
  test('a new student can sign up and is signed in straight away', async ({ page, backend }) => {
    await page.goto('/signup')
    await page.getByTestId('signup-email-input').fill('new.student@test.dev')
    await page.getByTestId('signup-password-input').fill('a-good-password')
    await page.getByTestId('signup-submit-btn').click()
    await expect(page.getByTestId('home-page')).toBeVisible()
    expect(backend.userByEmail('new.student@test.dev')).toBeTruthy()
    await openMenu(page)
    await expect(page.getByTestId('nav-logout-btn')).toBeVisible()
    await page.goto('/shortlist')
    await expect(page.getByTestId('shortlist-page')).toBeVisible()
  })

  test('a new account is a student, never an admin', async ({ page, backend }) => {
    await page.goto('/signup')
    await page.getByTestId('signup-email-input').fill('plain@test.dev')
    await page.getByTestId('signup-password-input').fill('a-good-password')
    await page.getByTestId('signup-submit-btn').click()
    await expect(page.getByTestId('home-page')).toBeVisible()
    expect(backend.userByEmail('plain@test.dev').app_metadata.role).toBeUndefined()
    await page.goto('/universities')
    await expect(page.getByTestId('admin-add-university')).toHaveCount(0)
  })

  test('the browser stops a password shorter than six characters', async ({ page, backend }) => {
    await page.goto('/signup')
    await page.getByTestId('signup-email-input').fill('short@test.dev')
    await page.getByTestId('signup-password-input').fill('12345')
    await page.getByTestId('signup-submit-btn').click()
    expect(backend.calls('/auth/v1/signup')).toHaveLength(0)
    await expect(page.getByTestId('signup-page')).toBeVisible()
  })

  test('if the form check is bypassed, the server still refuses a short password', async ({ page, backend }) => {
    await page.goto('/signup')
    await page.locator('form').evaluate((form) => (form.noValidate = true))
    await page.getByTestId('signup-email-input').fill('short@test.dev')
    await page.getByTestId('signup-password-input').fill('12345')
    await page.getByTestId('signup-submit-btn').click()
    await expect(page.getByTestId('signup-error')).toHaveText('Password should be at least 6 characters.')
    expect(backend.userByEmail('short@test.dev')).toBeUndefined()
  })

  test('an email that is already registered is refused', async ({ page, student }) => {
    await page.goto('/signup')
    await page.getByTestId('signup-email-input').fill(student.email)
    await page.getByTestId('signup-password-input').fill('another-password')
    await page.getByTestId('signup-submit-btn').click()
    await expect(page.getByTestId('signup-error')).toHaveText('User already registered')
    await expect(page.getByTestId('signup-page')).toBeVisible()
  })

  test.describe('when the project asks students to confirm their email', () => {
    test('the account exists but cannot log in until it is confirmed', async ({ page, backend }) => {
      backend.config.emailConfirmation = true
      await page.goto('/signup')
      await page.getByTestId('signup-email-input').fill('unconfirmed@test.dev')
      await page.getByTestId('signup-password-input').fill('a-good-password')
      await page.getByTestId('signup-submit-btn').click()
      await expect(page.getByTestId('home-page')).toBeVisible()
      expect(backend.userByEmail('unconfirmed@test.dev').confirmed).toBe(false)
      await openMenu(page)
      await expect(page.getByTestId('nav-login-link')).toBeVisible()

      await loginWithForm(page, 'unconfirmed@test.dev', 'a-good-password')
      await expect(page.getByTestId('login-error')).toHaveText('Email not confirmed')
    })

    test.fixme('tells the new student to check their email', async ({ page, backend }) => {
      // Known gap: after signing up the app just opens the home page, so a student who must
      // confirm their email gets no hint about it and cannot tell why they are logged out.
      backend.config.emailConfirmation = true
      await page.goto('/signup')
      await page.getByTestId('signup-email-input').fill('unconfirmed@test.dev')
      await page.getByTestId('signup-password-input').fill('a-good-password')
      await page.getByTestId('signup-submit-btn').click()
      await expect(page.getByText(/check your email|confirm your email/i)).toBeVisible()
    })
  })
})

test.describe('moving between the two forms', () => {
  test('login links to signup and back', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Sign Up' }).last().click()
    await expect(page.getByTestId('signup-page')).toBeVisible()
    await page.getByRole('link', { name: 'Log In' }).last().click()
    await expect(page.getByTestId('login-page')).toBeVisible()
  })
})
