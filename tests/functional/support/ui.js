// Small things most specs need. Selectors prefer what a person sees (roles, labels, text);
// data-testid is used where the app already provides one.
import { expect } from '@playwright/test'
import { MOCK } from './backend.js'

/**
 * Makes the next page load start signed in as `user`, the way a returning visitor would be
 * (supabase-js keeps the session in localStorage). It runs once per tab, so logging out in
 * the app and reloading really does log you out.
 */
export async function signIn(page, user, backend) {
  const session = backend.session(user)
  await page.context().addInitScript(
    ({ key, value, once }) => {
      if (sessionStorage.getItem(once)) return
      sessionStorage.setItem(once, '1')
      localStorage.setItem(key, value)
    },
    { key: MOCK.storageKey, value: JSON.stringify(session), once: `signed-in-${user.id}` },
  )
}

/** Logs in through the login form, as a person would, and waits for the outcome (the next page, or an error). */
export async function loginWithForm(page, email, password) {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(email)
  await page.getByTestId('login-password-input').fill(password)
  await page.getByTestId('login-submit-btn').click()
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith('/login')),
    page.getByTestId('login-error').waitFor(),
  ])
}

/** Waits until the app has finished fetching (nothing in flight for a moment). */
export const idle = (page) => page.context().mockBackend.whenIdle()

/** Opens the university list and waits for everything it loads, the shortlist included. */
export async function openUniversities(page) {
  await page.goto('/universities')
  await expect(page.getByTestId('university-card').first()).toBeVisible()
  await idle(page)
}

export const card = (page, name) => page.getByTestId('university-card').filter({ hasText: name })

export async function openUniversity(page, name) {
  await openUniversities(page)
  await page.getByTestId('filter-search-input').fill(name)
  await card(page, name).getByTestId('university-card-link').click()
  await expect(page.getByTestId('university-page')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
}

/** The visible text of every element a locator matches, in page order, with spacing tidied. */
export const texts = (locator) => locator.allTextContents().then((all) => all.map((t) => t.replace(/\s+/g, ' ').trim()))

/** The site menu is an off-canvas panel; its links can only be used while it is open. */
export async function openMenu(page) {
  const toggle = page.getByTestId('nav-toggle')
  const menu = page.locator('#nav-menu')
  await expect(menu).not.toHaveClass(/showing|hiding/) // a click during the slide animation is ignored
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toHaveClass(/show(?!ing)/)
  await expect(menu).not.toHaveClass(/showing/)
}

/** Opens the menu and follows one of its links, e.g. goTo(page, 'nav-shortlist'). */
export async function goTo(page, testId) {
  await openMenu(page)
  await page.getByTestId(testId).click()
}

/** True when the page scrolls sideways, which on a phone means something overflows. */
export const scrollsSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
