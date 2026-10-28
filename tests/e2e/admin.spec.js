import { test, expect } from '@playwright/test'
import { login } from './helpers'

// Needs an account whose app_metadata has role = admin (see README, "Admin accounts").
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

async function loginAsAdmin(page) {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(ADMIN_EMAIL)
  await page.getByTestId('login-password-input').fill(ADMIN_PASSWORD)
  await page.getByTestId('login-submit-btn').click()
  await page.getByTestId('nav-logout-btn').waitFor()
}

async function openFirstUniversity(page) {
  await page.goto('/universities')
  await page.getByTestId('university-card-link').first().click()
  await expect(page.getByTestId('university-page')).toBeVisible()
}

test.describe('students', () => {
  test('see no staff controls', async ({ page }) => {
    await login(page)
    await openFirstUniversity(page)
    await expect(page.getByTestId('nav-staff-badge')).toHaveCount(0)
    await expect(page.getByTestId('nav-preview-toggle')).toHaveCount(0)
    await expect(page.getByTestId('admin-bar')).toHaveCount(0)
    await expect(page.getByTestId('admin-edit-cost')).toHaveCount(0)
    await page.goto('/universities')
    await expect(page.getByTestId('admin-add-university')).toHaveCount(0)
    await expect(page.getByTestId('university-card-edit')).toHaveCount(0)
  })
})

test.describe('admins', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'set ADMIN_EMAIL and ADMIN_PASSWORD to run the admin tests')

  test('see the staff controls and can switch to the student view', async ({ page }) => {
    await loginAsAdmin(page)
    await openFirstUniversity(page)
    await expect(page.getByTestId('nav-staff-badge')).toBeVisible()
    await expect(page.getByTestId('admin-bar')).toBeVisible()
    await expect(page.getByTestId('admin-edit-cost')).toBeVisible()

    await page.getByTestId('nav-preview-toggle').click()
    await expect(page.getByTestId('admin-bar')).toHaveCount(0)
    await expect(page.getByTestId('admin-edit-cost')).toHaveCount(0)
    await expect(page.getByTestId('nav-preview-badge')).toBeVisible()

    await page.getByTestId('nav-preview-toggle').click()
    await expect(page.getByTestId('admin-bar')).toBeVisible()
  })

  test('the edit drawer validates and can be cancelled', async ({ page }) => {
    await loginAsAdmin(page)
    await openFirstUniversity(page)
    await page.getByTestId('admin-edit-cost').click()
    await page.getByTestId('admin-field-currency').fill('')
    await page.getByTestId('admin-drawer-save').click()
    await expect(page.getByTestId('admin-field-error').first()).toContainText('currency')
    await page.getByTestId('admin-drawer-cancel').click()
    await expect(page.getByTestId('admin-drawer')).toHaveCount(0)
  })

  test('add a university, fill it in, publish, hide and delete it', async ({ page, browser }) => {
    const name = `E2E University ${Date.now()}`
    const baseURL = test.info().project.use.baseURL
    const visitor = await (await browser.newContext({ baseURL })).newPage()
    const listed = async () => {
      await visitor.goto('/universities')
      await expect(page.getByTestId('universities-page')).toBeVisible()
      return visitor.getByTestId('university-card-name').filter({ hasText: name }).count()
    }

    await loginAsAdmin(page)
    await page.goto('/universities')
    await page.getByTestId('admin-add-university').click()
    await page.getByTestId('admin-field-name').fill(name)
    await page.getByTestId('admin-field-country').fill('Testland')
    await page.getByTestId('admin-field-region').fill('Europe')
    await page.getByTestId('admin-drawer-save').click()
    await expect(page.getByTestId('admin-hidden-banner')).toBeVisible()
    await expect(page.getByTestId('admin-delete')).toBeEnabled()

    await page.getByTestId('admin-edit-cost').click()
    await page.getByTestId('admin-field-currency').fill('EUR')
    await page.getByTestId('admin-field-accommodation').fill('1000')
    await page.getByTestId('admin-drawer-save').click()
    await expect(page.getByTestId('admin-drawer')).toHaveCount(0)
    await expect(page.getByTestId('admin-hidden-banner')).not.toContainText('costs')

    expect(await listed()).toBe(0) // still hidden from students

    await page.getByTestId('admin-publish').click()
    await expect(page.getByTestId('admin-hidden-banner')).toHaveCount(0)
    await expect(page.getByTestId('admin-delete')).toBeDisabled()
    expect(await listed()).toBe(1)

    await page.getByTestId('admin-hide').click()
    await expect(page.getByTestId('admin-hidden-banner')).toBeVisible()
    expect(await listed()).toBe(0)

    await page.getByTestId('admin-delete').click()
    await expect(page.getByTestId('delete-impact')).toBeVisible()
    await expect(page.getByTestId('confirm-ok')).toBeDisabled()
    await page.getByTestId('confirm-typed-input').fill(name)
    await page.getByTestId('confirm-ok').click()
    await expect(page.getByTestId('universities-page')).toBeVisible()
    await expect(page.getByTestId('university-card-name').filter({ hasText: name })).toHaveCount(0)
    await visitor.context().close()
  })
})
