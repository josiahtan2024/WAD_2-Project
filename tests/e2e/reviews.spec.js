import { test, expect } from '@playwright/test'
import { login } from './helpers'

// 1x1 PNG, enough to exercise the upload path
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function openFirstUniversity(page) {
  await page.goto('/universities')
  await page.getByTestId('university-card-link').first().click()
  await expect(page.getByTestId('review-carousel')).toBeVisible()
  await expect(page.getByTestId('reviews-loading')).toHaveCount(0)
}

async function postReview(page, text, stars = 4) {
  await page.getByTestId(`review-rating-${stars}`).click()
  await page.getByTestId('review-body-input').fill(text)
  await page.getByTestId('review-submit-btn').click()
}

// One review per user per university, so every test starts without one.
async function deleteMyReview(page) {
  while (await page.getByTestId('review-delete-btn').count()) {
    await page.getByTestId('review-delete-btn').first().click()
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(0)
  }
}

test.describe('reviews (logged out)', () => {
  test('is asked to log in to review and comment', async ({ page }) => {
    await openFirstUniversity(page)
    await expect(page.getByTestId('review-login-prompt')).toBeVisible()
    await expect(page.getByTestId('review-body-input')).toHaveCount(0)
  })
})

test.describe('reviews', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())
    await login(page)
    await openFirstUniversity(page)
    await deleteMyReview(page)
  })

  test('post a review, it appears first with its rating', async ({ page }) => {
    const text = `Great exchange ${Date.now()}`
    await postReview(page, text, 5)
    await expect(page.getByTestId('review-item').first()).toContainText(text)
    await expect(page.getByTestId('review-item').first().getByTestId('review-rating')).toHaveAttribute('aria-label', '5 out of 5')
    await expect(page.getByTestId('reviews-average')).toContainText('5.0 out of 5')
    await page.reload()
    await expect(page.getByTestId('review-carousel')).toContainText(text)
  })

  test('shows topic ratings that were filled in', async ({ page }) => {
    await page.getByTestId('review-academics_rating-3').click()
    await postReview(page, 'Topic ratings test')
    await expect(page.getByTestId('review-item').first()).toContainText('Academics 3/5')
    await expect(page.getByTestId('review-item').first()).not.toContainText('Campus life')
  })

  test('needs an overall rating and some text', async ({ page }) => {
    await page.getByTestId('review-body-input').fill('No rating given')
    await page.getByTestId('review-submit-btn').click()
    await expect(page.getByTestId('review-form-error')).toContainText('overall rating')
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(0)

    await page.getByTestId('review-rating-3').click()
    await page.getByTestId('review-body-input').fill('   ')
    await page.getByTestId('review-submit-btn').click()
    await expect(page.getByTestId('review-form-error')).toContainText('few words')
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(0)
  })

  test('a second review for the same university is refused', async ({ page }) => {
    await postReview(page, 'First review')
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(1)
    await postReview(page, 'Second review')
    await expect(page.getByTestId('review-form-error')).toContainText('already reviewed')
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(1)
  })

  test('review text is shown as text, not as HTML', async ({ page }) => {
    const markup = '<img src=x onerror="window.__xss = true"> <b>bold</b>'
    await postReview(page, markup)
    await expect(page.getByTestId('review-body').first()).toHaveText(markup)
    expect(await page.evaluate(() => window.__xss)).toBeUndefined()
  })

  test('a very long unbroken word does not break the layout', async ({ page }) => {
    await postReview(page, 'a'.repeat(1500))
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(1)
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflows).toBe(false)
  })

  test('upload a photo with a review', async ({ page }) => {
    await page.getByTestId('review-image-input').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: TINY_PNG })
    await postReview(page, 'Review with a photo')
    await expect(page.getByTestId('review-image').first()).toBeVisible()
  })

  test('add and delete a comment', async ({ page }) => {
    await postReview(page, 'Review to comment on')
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(1)
    const mine = page.getByTestId('review-item').first()
    await mine.getByTestId('comment-input').fill('Thanks for sharing')
    await mine.getByTestId('comment-submit-btn').click()
    await expect(mine.getByTestId('comment-item')).toContainText('Thanks for sharing')
    await page.reload()
    await expect(page.getByTestId('review-item').first().getByTestId('comment-item')).toHaveCount(1)
    await page.getByTestId('review-item').first().getByTestId('comment-delete-btn').click()
    await expect(page.getByTestId('review-item').first().getByTestId('comment-item')).toHaveCount(0)
  })

  test('delete your own review', async ({ page }) => {
    await postReview(page, 'Review to delete')
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(1)
    await page.getByTestId('review-delete-btn').click()
    await expect(page.getByTestId('reviews-empty')).toBeVisible()
  })
})

test.describe('reviews on a phone', () => {
  test.use({ viewport: { width: 375, height: 700 } })

  test('the form and carousel fit the screen', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept())
    await login(page)
    await openFirstUniversity(page)
    await deleteMyReview(page)
    await postReview(page, 'Phone sized review')
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(1)
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflows).toBe(false)
  })
})
