import { test, expect } from './support/fixtures.js'
import { goTo, openMenu, signIn } from './support/ui.js'

const LINKS = {
  visitor: ['nav-home', 'nav-universities', 'nav-compare', 'nav-courses', 'nav-about', 'nav-login-link', 'nav-signup-link'],
  student: ['nav-home', 'nav-universities', 'nav-compare', 'nav-courses', 'nav-about', 'nav-shortlist', 'nav-cost-estimator', 'nav-schedule', 'nav-logout-btn'],
}
const EVERY_LINK = [...new Set([...LINKS.visitor, ...LINKS.student, 'nav-preview-toggle'])]

test.describe('what the menu offers', () => {
  test('a visitor sees the public pages and the login and signup buttons only', async ({ page }) => {
    await page.goto('/')
    await openMenu(page)
    for (const id of EVERY_LINK) {
      if (LINKS.visitor.includes(id)) await expect(page.getByTestId(id)).toBeVisible()
      else await expect(page.getByTestId(id)).toHaveCount(0)
    }
  })

  test('a student also gets shortlist, budget, schedule and log out', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/')
    await openMenu(page)
    for (const id of EVERY_LINK) {
      if (LINKS.student.includes(id)) await expect(page.getByTestId(id)).toBeVisible()
      else await expect(page.getByTestId(id)).toHaveCount(0)
    }
  })

  test('an admin additionally gets the preview switch and an Admin badge', async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await page.goto('/')
    await openMenu(page)
    await expect(page.getByTestId('nav-preview-toggle')).toBeVisible()
    await expect(page.getByTestId('nav-staff-badge').filter({ visible: true })).toBeVisible()
    for (const id of LINKS.student) await expect(page.getByTestId(id)).toBeVisible()
  })

  test('a student never sees admin controls in the menu', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/')
    await openMenu(page)
    await expect(page.getByTestId('nav-staff-badge')).toHaveCount(0)
    await expect(page.getByTestId('nav-preview-toggle')).toHaveCount(0)
  })
})

test.describe('using the menu', () => {
  test('it starts closed, opens on the button and closes on the close button', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByTestId('nav-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('nav-universities')).toBeHidden()
    await openMenu(page)
    await page.locator('#nav-menu').getByRole('button', { name: 'Close' }).click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('nav-universities')).toBeHidden()
  })

  test('Escape closes it', async ({ page }) => {
    await page.goto('/')
    await openMenu(page)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('nav-toggle')).toHaveAttribute('aria-expanded', 'false')
  })

  test('choosing a page closes the menu', async ({ page }) => {
    await page.goto('/')
    await goTo(page, 'nav-universities')
    await expect(page).toHaveURL(/\/universities$/)
    await expect(page.getByTestId('nav-toggle')).toHaveAttribute('aria-expanded', 'false')
  })

  const destinations = [
    ['nav-home', '/', 'Home | SMUXchange'],
    ['nav-universities', '/universities', 'Partner Universities | SMUXchange'],
    ['nav-compare', '/compare', 'Compare Universities | SMUXchange'],
    ['nav-courses', '/courses', 'Course Search | SMUXchange'],
    ['nav-about', '/about', 'About Us | SMUXchange'],
    ['nav-shortlist', '/shortlist', 'My Shortlist | SMUXchange'],
    ['nav-cost-estimator', '/cost-estimator', 'Cost Estimator | SMUXchange'],
    ['nav-schedule', '/schedule', 'My Schedule | SMUXchange'],
  ]
  for (const [id, path, title] of destinations) {
    test(`${id} goes to ${path} and sets the tab title`, async ({ page, student, backend }) => {
      await signIn(page, student, backend)
      await page.goto(path === '/about' ? '/universities' : '/about')
      await goTo(page, id)
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : `${path}$`}`))
      await expect(page).toHaveTitle(title)
    })
  }

  test('the SMUXchange name goes home', async ({ page }) => {
    await page.goto('/about')
    await page.getByTestId('nav-brand').click()
    await expect(page.getByTestId('home-page')).toBeVisible()
  })

  test('the footer links work', async ({ page }) => {
    await page.goto('/compare') // the home page has no footer
    const footer = page.getByRole('navigation', { name: 'Footer navigation' })
    await footer.getByRole('link', { name: 'Universities' }).click()
    await expect(page).toHaveURL(/\/universities$/)
    await footer.getByRole('link', { name: 'Course Search' }).click()
    await expect(page).toHaveURL(/\/courses$/)
    await footer.getByRole('link', { name: 'About Us' }).click()
    await expect(page).toHaveURL(/\/about$/)
  })

  test('the browser back and forward buttons follow the pages', async ({ page }) => {
    await page.goto('/')
    await goTo(page, 'nav-universities')
    await goTo(page, 'nav-about')
    await page.goBack()
    await expect(page).toHaveURL(/\/universities$/)
    await page.goBack()
    await expect(page.getByTestId('home-page')).toBeVisible()
    await page.goForward()
    await expect(page).toHaveURL(/\/universities$/)
  })
})

test.describe('addresses', () => {
  for (const path of ['/universities', '/universities/3', '/compare', '/courses', '/about']) {
    test(`opening ${path} directly works (a bookmark or a refresh)`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByTestId('nav-bar')).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await page.reload()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByTestId('nav-bar')).toBeVisible()
    })
  }

  test('an address that does not exist does not break the site', async ({ page }) => {
    await page.goto('/this/page/does/not/exist')
    await expect(page.getByTestId('nav-bar')).toBeVisible()
    await goTo(page, 'nav-universities')
    await expect(page.getByTestId('university-card').first()).toBeVisible()
  })

  test.fixme('an address that does not exist shows a "page not found" message', async ({ page }) => {
    // Known gap: there is no catch-all route, so a mistyped address leaves an empty page.
    await page.goto('/this/page/does/not/exist')
    await expect(page.getByText(/not found|doesn.t exist/i)).toBeVisible()
  })
})
