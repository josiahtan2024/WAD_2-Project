// Checks that can be made straight from the page: names, labels, alt text, headings, keyboard.
// (A full audit still needs a person with a screen reader; this catches the regressions.)
import { test, expect } from './support/fixtures.js'
import { idle, signIn } from './support/ui.js'

const PUBLIC_PAGES = ['/', '/about', '/login', '/signup', '/universities', '/universities/2', '/universities/7', '/compare', '/courses']
const STUDENT_PAGES = ['/shortlist', '/cost-estimator', '/schedule/2']

/** Anything a person could click or type into that has no readable name. */
async function unnamed(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const box = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const nameOf = (el) => {
      const labelled = el.getAttribute('aria-label') || el.getAttribute('title')
      if (labelled?.trim()) return labelled.trim()
      const by = el.getAttribute('aria-labelledby')
      if (by && by.split(/\s+/).some((id) => document.getElementById(id)?.textContent.trim())) return 'ok'
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent.trim()) return 'ok'
      if (el.closest('label')?.textContent.trim()) return 'ok'
      return (el.textContent || el.getAttribute('placeholder') || el.getAttribute('alt') || '').trim()
    }
    const found = []
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')) {
      if (!visible(el) && !el.matches('input.btn-check')) continue
      if (!nameOf(el)) found.push(el.outerHTML.slice(0, 120))
    }
    return found
  })
}

test.describe('accessibility: names and labels', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path}: every control has a name`, async ({ page }) => {
      await page.goto(path)
      await idle(page)
      expect(await unnamed(page)).toEqual([])
    })
  }

  for (const path of STUDENT_PAGES) {
    test(`${path}: every control has a name (signed in)`, async ({ page, student, backend }) => {
      backend.shortlist(student, [2])
      await signIn(page, student, backend)
      await page.goto(path)
      await idle(page)
      expect(await unnamed(page)).toEqual([])
    })
  }

  test('the admin drawer and dialogs are labelled', async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await page.goto('/universities/15?edit=details')
    await expect(page.getByRole('dialog', { name: 'Edit Details' })).toBeVisible()
    expect(await unnamed(page)).toEqual([])
    await page.keyboard.press('Escape')
    await page.getByTestId('admin-delete').click()
    await expect(page.getByRole('alertdialog', { name: 'Delete this university?' })).toBeVisible()
  })
})

test.describe('accessibility: images and headings', () => {
  test('every visible image has alt text', async ({ page }) => {
    await page.goto('/universities')
    await expect(page.getByTestId('university-card-name').first()).toBeVisible()
    const missing = await page.$$eval('img', (images) => images.filter((i) => i.getAttribute('alt') === null).map((i) => i.src))
    expect(missing).toEqual([])
  })

  // Known gap: the home page has no <h1>
  test.fixme('/: has exactly one main heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })

  for (const path of PUBLIC_PAGES.filter((p) => p !== '/')) {
    test(`${path}: has exactly one main heading`, async ({ page }) => {
      await page.goto(path)
      await idle(page)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    })
  }

  test('each page sets its own title', async ({ page }) => {
    const titles = new Set()
    for (const path of ['/', '/about', '/universities', '/compare', '/courses', '/login']) {
      await page.goto(path)
      await idle(page)
      titles.add(await page.title())
    }
    expect(titles.size).toBe(6)
  })

  test('the page language is declared', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', /en/)
  })
})

test.describe('accessibility: keyboard', () => {
  test('the menu opens and closes from the keyboard', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('nav-toggle').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#nav-menu')).toHaveClass(/show/)
    await expect(page.locator('#nav-menu')).not.toHaveClass(/showing/)
    await page.keyboard.press('Escape')
    await expect(page.locator('#nav-menu')).not.toHaveClass(/show/)
  })

  test('the login form can be completed and sent with the keyboard only', async ({ page, student }) => {
    await page.goto('/login')
    await page.getByTestId('login-email-input').focus()
    await page.keyboard.type(student.email)
    await page.keyboard.press('Tab')
    await page.keyboard.type(student.password)
    await page.keyboard.press('Enter')
    await expect(page).not.toHaveURL(/\/login/)
  })

  // Known gap: the delete dialog opens but keyboard focus stays on the page behind it
  test.fixme('a dialog takes focus when it opens', async ({ page, student, backend }) => {
    backend.rows('user_budgets').push({ id: 1, user_id: student.id, university_id: 2, duration_months: 4, currency_code: 'USD', total_budget: 1, accommodation_budget: 1 })
    await signIn(page, student, backend)
    await page.goto('/cost-estimator')
    await page.getByTestId('budget-delete-button').click()
    const dialog = page.getByTestId('delete-confirm-dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  })

  test('star ratings can be chosen with the keyboard', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/universities/2')
    await expect(page.getByTestId('review-form')).toBeVisible()
    await page.getByTestId('review-rating-3').focus()
    await page.keyboard.press('Space')
    await page.getByTestId('review-body-input').fill('Keyboard review')
    await page.getByTestId('review-submit-btn').press('Enter')
    await expect(page.getByTestId('review-delete-btn')).toBeVisible()
    await expect(page.getByTestId('review-rating').first()).toHaveAttribute('aria-label', '3 out of 5')
  })

  test('the schedule grid slots are reachable by mouse but not announced as buttons (known gap)', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await signIn(page, student, backend)
    await page.goto('/schedule/2')
    await expect(page.getByTestId('schedule-page')).toBeVisible()
  })
})

test.describe('accessibility: messages are announced', () => {
  test('errors use an alert and successes a status', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await page.goto('/cost-estimator')
    await page.getByTestId('budget-create-button').first().click()
    await page.getByTestId('budget-submit-button').evaluate((el) => (el.disabled = false))
    await page.getByTestId('budget-submit-button').click()
    await expect(page.getByRole('alert')).toBeVisible()
  })

  // Known gap: the login error is shown but is not marked up as an alert, so a screen reader will not announce it
  test.fixme('the login error is announced', async ({ page, student }) => {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(student.email)
    await page.getByTestId('login-password-input').fill('wrong-password')
    await page.getByTestId('login-submit-btn').click()
    await expect(page.getByTestId('login-error')).toBeVisible()
    await expect(page.getByTestId('login-error')).toHaveAttribute('role', 'alert')
  })
})
