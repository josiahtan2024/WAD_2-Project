import { test, expect } from './support/fixtures.js'
import { idle, signIn, nav } from './support/ui.js'

// University College London (id 7) has two seeded reviews: Bea's (3 stars, newest) and Alex's (5 stars).
const UCL = 7
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const items = (page) => page.getByTestId('review-item')
/** The review being shown (the carousel shows one at a time). */
const current = (page) => page.locator('.carousel-item.active')
const reviewsOf = (backend, universityId) => backend.rows('university_reviews').filter((r) => r.university_id === universityId)

async function openUniversity(page, id = UCL) {
  await page.goto(`/universities/${id}`)
  await expect(page.getByTestId('review-carousel')).toBeVisible()
  await expect(page.getByTestId('reviews-loading')).toHaveCount(0)
  await idle(page)
}

async function post(page, text, stars = 4) {
  await page.getByTestId(`review-rating-${stars}`).click()
  await page.getByTestId('review-body-input').fill(text)
  await page.getByTestId('review-submit-btn').click()
}

test.describe('reviews: reading', () => {
  test('shows the reviews with an average, newest first', async ({ page }) => {
    await openUniversity(page)
    await expect(page.getByTestId('reviews-average')).toContainText('4.0 out of 5 from 2 reviews')
    await expect(items(page)).toHaveCount(2)
    await expect(current(page)).toContainText('Good semester, but housing was expensive')
    await expect(current(page).getByTestId('review-rating')).toHaveAttribute('aria-label', '3 out of 5')
    await expect(current(page)).toContainText('SMU student')
  })

  test('shows only the topics that were rated', async ({ page }) => {
    await openUniversity(page)
    await expect(current(page)).toContainText('Accommodation: 2/5')
    await expect(current(page)).not.toContainText('Academics')
    await page.getByTestId('review-next-btn').click()
    await expect(current(page)).toContainText('London was incredible')
    await expect(current(page)).toContainText('Academics: 4/5')
    await expect(current(page)).toContainText('Cost of living: 2/5')
    await expect(current(page)).toContainText('Campus life: 5/5')
    await expect(current(page)).not.toContainText('Accommodation')
  })

  test('steps through the reviews and keeps count', async ({ page }) => {
    await openUniversity(page)
    await expect(page.getByText('1 / 2')).toBeVisible()
    await page.getByTestId('review-next-btn').click()
    await expect(page.getByText('2 / 2')).toBeVisible()
    await page.getByTestId('review-prev-btn').click()
    await expect(page.getByText('1 / 2')).toBeVisible()
  })

  test('says so when a university has no reviews', async ({ page }) => {
    await openUniversity(page, 2)
    await expect(page.getByTestId('reviews-empty')).toContainText('No reviews yet')
    await expect(page.getByTestId('reviews-average')).toHaveCount(0)
  })

  test('shows a comment under the review it belongs to', async ({ page }) => {
    await openUniversity(page)
    await expect(current(page).getByTestId('comment-item')).toHaveCount(0)
    await page.getByTestId('review-next-btn').click()
    await expect(current(page).getByTestId('comment-item')).toContainText('Which hall did you stay in?')
  })

  test('reviews of another university do not leak in', async ({ page }) => {
    await openUniversity(page, 2)
    await page.goto(`/universities/${UCL}`)
    await expect(page.getByTestId('reviews-average')).toBeVisible()
    await page.goBack()
    await expect(page.getByTestId('reviews-empty')).toBeVisible()
  })

  test('shows an error instead of reviews when they cannot be loaded', async ({ page, backend }) => {
    backend.fail('/rest/v1/university_reviews', { status: 500, body: { message: 'reviews are unavailable' } })
    await page.goto(`/universities/${UCL}`)
    await expect(page.getByTestId('reviews-error')).toContainText('reviews are unavailable')
  })
})

test.describe('reviews: logged out', () => {
  test('can read but is asked to log in to post or comment', async ({ page }) => {
    await openUniversity(page)
    await expect(page.getByTestId('review-login-prompt')).toBeVisible()
    await expect(page.getByTestId('review-body-input')).toHaveCount(0)
    await expect(page.getByTestId('comment-login-prompt').first()).toBeVisible()
    await expect(page.getByTestId('comment-input')).toHaveCount(0)
    await expect(page.getByTestId('review-edit-btn')).toHaveCount(0)
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(0)
  })
})

test.describe('reviews: writing one', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openUniversity(page)
  })

  test('a posted review appears first and changes the average', async ({ page, student, backend }) => {
    await post(page, 'Best semester of my degree', 5)
    await expect(page.getByTestId('notice-success-message')).toHaveText('Your review was posted successfully.')
    await expect(current(page)).toContainText('Best semester of my degree')
    await expect(current(page)).toContainText('You')
    await expect(current(page).getByTestId('review-rating')).toHaveAttribute('aria-label', '5 out of 5')
    await expect(page.getByTestId('reviews-average')).toContainText('4.3 out of 5 from 3 reviews')
    const [mine] = reviewsOf(backend, UCL).filter((r) => r.user_id === student.id)
    expect(mine).toMatchObject({ rating: 5, review: 'Best semester of my degree', academics_rating: null })
  })

  test('stays after a reload', async ({ page }) => {
    await post(page, 'Still here after a reload')
    await expect(page.getByTestId('review-delete-btn')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('review-carousel')).toContainText('Still here after a reload')
  })

  test('saves the topic ratings that were chosen', async ({ page, student, backend }) => {
    await page.getByTestId('review-academics_rating-3').click()
    await page.getByTestId('review-campus_rating-5').click()
    await post(page, 'Topic ratings')
    await expect(current(page)).toContainText('Academics: 3/5')
    await expect(current(page)).toContainText('Campus life: 5/5')
    await expect(current(page)).not.toContainText('Cost of living')
    const mine = reviewsOf(backend, UCL).find((r) => r.user_id === student.id)
    expect(mine).toMatchObject({ academics_rating: 3, campus_rating: 5, cost_rating: null, accommodation_rating: null })
  })

  test('needs an overall rating', async ({ page, backend }) => {
    await page.getByTestId('review-body-input').fill('No rating given')
    await page.getByTestId('review-submit-btn').click()
    await expect(page.getByTestId('review-form-error')).toHaveText('Pick an overall rating.')
    expect(reviewsOf(backend, UCL)).toHaveLength(2)
  })

  test('needs some words', async ({ page, backend }) => {
    await page.getByTestId('review-rating-3').click()
    await page.getByTestId('review-body-input').fill('    ')
    await page.getByTestId('review-submit-btn').click()
    await expect(page.getByTestId('review-form-error')).toContainText('few words')
    expect(reviewsOf(backend, UCL)).toHaveLength(2)
  })

  test('the text box stops at 2000 characters', async ({ page }) => {
    await page.getByTestId('review-body-input').fill('x'.repeat(2500))
    await expect(page.getByTestId('review-body-input')).toHaveValue('x'.repeat(2000))
  })

  test('once you have reviewed, the form is replaced by a note', async ({ page }) => {
    await post(page, 'My one review')
    await expect(page.getByTestId('review-already-posted')).toBeVisible()
    await expect(page.getByTestId('review-body-input')).toHaveCount(0)
  })

  test('a second review for the same university is refused by the database too', async ({ page, student, backend }) => {
    backend.rows('university_reviews').push({ id: 99, user_id: student.id, university_id: UCL, rating: 4, review: 'Written in another tab', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    await post(page, 'Trying again', 5)
    await expect(page.getByTestId('review-form-error')).toContainText('already reviewed this university')
    expect(reviewsOf(backend, UCL).filter((r) => r.user_id === student.id)).toHaveLength(1)
  })

  test('review text is shown as text, never as HTML', async ({ page }) => {
    const markup = '<img src=x onerror="window.__xss = true"> <b>bold</b>'
    await post(page, markup)
    await expect(current(page).getByTestId('review-body')).toHaveText(markup)
    expect(await page.evaluate(() => window.__xss)).toBeUndefined()
    await expect(current(page).locator('b')).toHaveCount(0)
  })

  test('keeps line breaks', async ({ page }) => {
    await post(page, 'First line\nSecond line')
    await expect(current(page).getByTestId('review-body')).toHaveCSS('white-space', 'pre-line')
  })

  test('a very long unbroken word does not break the layout', async ({ page }) => {
    await post(page, 'a'.repeat(1500))
    await expect(page.getByTestId('review-delete-btn')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  })

  test('shows the error and keeps what was typed when posting fails', async ({ page, backend }) => {
    backend.fail('/rest/v1/university_reviews', { status: 500, body: { message: 'database is down' }, times: 1 })
    await post(page, 'Please do not lose this', 4)
    await expect(page.getByTestId('review-form-error')).toContainText('database is down')
    await expect(page.getByTestId('review-body-input')).toHaveValue('Please do not lose this')
    await page.getByTestId('review-submit-btn').click()
    await expect(page.getByTestId('review-delete-btn')).toBeVisible()
  })

  test('posting twice quickly only posts once', async ({ page, student, backend }) => {
    backend.slow('/rest/v1/university_reviews', 400)
    await page.getByTestId('review-rating-4').click()
    await page.getByTestId('review-body-input').fill('Double click')
    await page.getByTestId('review-submit-btn').dblclick()
    await expect(page.getByTestId('review-delete-btn')).toBeVisible()
    expect(reviewsOf(backend, UCL).filter((r) => r.user_id === student.id)).toHaveLength(1)
  })
})

test.describe('reviews: photos', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openUniversity(page)
  })

  const png = (name = 'photo.png') => ({ name, mimeType: 'image/png', buffer: TINY_PNG })

  test('uploads a photo with the review and shows it', async ({ page, student, backend }) => {
    await page.getByTestId('review-image-input').setInputFiles(png())
    await post(page, 'With a photo')
    const image = current(page).getByTestId('review-image')
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
    const mine = reviewsOf(backend, UCL).find((r) => r.user_id === student.id)
    expect(mine.image_path).toMatch(new RegExp(`^${student.id}/.+\\.png$`))
    expect(backend.files.has(`review-images/${mine.image_path}`)).toBe(true)
  })

  test('refuses a file that is not JPG, PNG or WebP', async ({ page, backend }) => {
    await page.getByTestId('review-image-input').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
    await post(page, 'Wrong kind of file')
    await expect(page.getByTestId('review-form-error')).toHaveText('Photos must be JPG, PNG or WebP.')
    expect(reviewsOf(backend, UCL)).toHaveLength(2)
  })

  test('refuses a photo over 2 MB', async ({ page, backend }) => {
    await page.getByTestId('review-image-input').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
    await post(page, 'Too big')
    await expect(page.getByTestId('review-form-error')).toHaveText('Photos must be 2 MB or smaller.')
    expect(reviewsOf(backend, UCL)).toHaveLength(2)
  })

  test('does not leave an orphaned photo behind when the review is rejected', async ({ page, backend }) => {
    backend.fail('/rest/v1/university_reviews', { status: 500, body: { message: 'database is down' }, times: 1 })
    await page.getByTestId('review-image-input').setInputFiles(png())
    await post(page, 'Photo then failure')
    await expect(page.getByTestId('review-form-error')).toBeVisible()
    await idle(page)
    expect([...backend.files.keys()].filter((k) => k.startsWith('review-images/'))).toHaveLength(0)
  })

  test('removes the photo when the review is deleted', async ({ page, backend }) => {
    await page.getByTestId('review-image-input').setInputFiles(png())
    await post(page, 'Photo to delete with the review')
    await expect(current(page).getByTestId('review-image')).toBeVisible()
    await current(page).getByTestId('review-delete-btn').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(page.getByTestId('review-already-posted')).toHaveCount(0)
    await idle(page)
    expect([...backend.files.keys()].filter((k) => k.startsWith('review-images/'))).toHaveLength(0)
  })
})

test.describe('reviews: editing your own', () => {
  let review
  test.beforeEach(async ({ page, student, backend }) => {
    review = { id: 50, user_id: student.id, university_id: UCL, exchange_period_id: null, rating: 2, academics_rating: null, accommodation_rating: null, cost_rating: null, campus_rating: null, review: 'Original text', image_path: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    backend.rows('university_reviews').push(review)
    await signIn(page, student, backend)
    await openUniversity(page)
  })

  test('only your own review has Edit and Delete', async ({ page }) => {
    await expect(page.getByTestId('review-edit-btn')).toHaveCount(1)
    await expect(page.getByTestId('review-delete-btn')).toHaveCount(1)
    await expect(current(page)).toContainText('You')
  })

  test('opens the form filled in', async ({ page }) => {
    await current(page).getByTestId('review-edit-btn').click()
    await expect(current(page).getByTestId('review-body-input')).toHaveValue('Original text')
    await expect(current(page).getByRole('heading', { name: 'Edit Your Review' })).toBeVisible()
    await expect(current(page).getByTestId('review-submit-btn')).toHaveText('Save Changes')
  })

  test('saves the change and marks the review as edited', async ({ page, backend }) => {
    backend.backdate('university_reviews', (r) => r.id === 50, 60_000)
    await page.reload()
    await expect(current(page).getByTestId('review-edited')).toHaveCount(0)
    await current(page).getByTestId('review-edit-btn').click()
    await current(page).getByTestId('review-rating-5').click()
    await current(page).getByTestId('review-cost_rating-4').click()
    await current(page).getByTestId('review-body-input').fill('Changed my mind, it was great')
    await current(page).getByTestId('review-submit-btn').click()
    await expect(page.getByTestId('notice-success-message')).toHaveText('Your review was updated successfully.')
    await expect(current(page)).toContainText('Changed my mind, it was great')
    await expect(current(page)).toContainText('Cost of living: 4/5')
    await expect(current(page).getByTestId('review-rating')).toHaveAttribute('aria-label', '5 out of 5')
    await expect(current(page).getByTestId('review-edited')).toBeVisible()
    expect(reviewsOf(backend, UCL).find((r) => r.id === 50)).toMatchObject({ rating: 5, cost_rating: 4, review: 'Changed my mind, it was great' })
  })

  test('is not marked as edited if saved within a second of posting', async ({ page }) => {
    await current(page).getByTestId('review-edit-btn').click()
    await current(page).getByTestId('review-body-input').fill('Quick fix')
    await current(page).getByTestId('review-submit-btn').click()
    await expect(current(page)).toContainText('Quick fix')
    await expect(current(page).getByTestId('review-edited')).toHaveCount(0)
  })

  test('can clear a topic rating by editing', async ({ page, backend }) => {
    backend.find('university_reviews', (r) => r.id === 50).cost_rating = 3
    await page.reload()
    await expect(current(page)).toContainText('Cost of living: 3/5')
  })

  test('Cancel keeps the review as it was', async ({ page }) => {
    await current(page).getByTestId('review-edit-btn').click()
    await current(page).getByTestId('review-body-input').fill('Discard me')
    await current(page).getByTestId('review-cancel-btn').click()
    await expect(current(page)).toContainText('Original text')
    await expect(current(page)).not.toContainText('Discard me')
    await expect(current(page).getByTestId('review-edit-btn')).toBeVisible()
  })

  test('an edit still needs some words', async ({ page, backend }) => {
    await current(page).getByTestId('review-edit-btn').click()
    await current(page).getByTestId('review-body-input').fill('   ')
    await current(page).getByTestId('review-submit-btn').click()
    await expect(current(page).getByTestId('review-form-error')).toContainText('few words')
    expect(backend.find('university_reviews', (r) => r.id === 50).review).toBe('Original text')
  })

  test('removes or replaces the photo', async ({ page, backend }) => {
    const png = { name: 'photo.png', mimeType: 'image/png', buffer: TINY_PNG }
    await current(page).getByTestId('review-edit-btn').click()
    await current(page).getByTestId('review-image-input').setInputFiles(png)
    await current(page).getByTestId('review-submit-btn').click()
    await expect(current(page).getByTestId('review-image')).toBeVisible()
    const first = backend.find('university_reviews', (r) => r.id === 50).image_path

    await current(page).getByTestId('review-edit-btn').click()
    await current(page).getByTestId('review-image-input').setInputFiles({ ...png, name: 'again.png' })
    await current(page).getByTestId('review-submit-btn').click()
    await expect.poll(() => backend.find('university_reviews', (r) => r.id === 50).image_path).not.toBe(first)
    await idle(page)
    expect(backend.files.has(`review-images/${first}`)).toBe(false)

    await current(page).getByTestId('review-edit-btn').click()
    await current(page).getByTestId('review-remove-image').check()
    await current(page).getByTestId('review-submit-btn').click()
    await expect(current(page).getByTestId('review-image')).toHaveCount(0)
    expect(backend.find('university_reviews', (r) => r.id === 50).image_path).toBeNull()
  })

  test('shows the error when the update fails and stays in the form', async ({ page, backend }) => {
    await current(page).getByTestId('review-edit-btn').click()
    backend.fail('/rest/v1/university_reviews', { status: 500, body: { message: 'database is down' }, times: 1 })
    await current(page).getByTestId('review-body-input').fill('Will not save')
    await current(page).getByTestId('review-submit-btn').click()
    await expect(current(page).getByTestId('review-form-error')).toContainText('database is down')
    await expect(current(page).getByTestId('review-body-input')).toHaveValue('Will not save')
  })

  test('says the review no longer exists if it was deleted elsewhere', async ({ page, backend }) => {
    await current(page).getByTestId('review-edit-btn').click()
    backend.rows('university_reviews').splice(backend.rows('university_reviews').findIndex((r) => r.id === 50), 1)
    await current(page).getByTestId('review-body-input').fill('Too late')
    await current(page).getByTestId('review-submit-btn').click()
    await expect(current(page).getByTestId('review-form-error')).toContainText('no longer exists')
  })
})

test.describe('reviews: deleting your own', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    backend.rows('university_reviews').push({ id: 50, user_id: student.id, university_id: UCL, rating: 2, review: 'Delete me', image_path: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    await signIn(page, student, backend)
    await openUniversity(page)
  })

  test('asks first; Cancel keeps it', async ({ page, backend }) => {
    await current(page).getByTestId('review-delete-btn').click()
    await expect(page.getByTestId('delete-confirm-dialog')).toContainText('Delete Review?')
    await page.getByTestId('delete-confirm-cancel').click()
    await expect(page.getByTestId('delete-confirm-dialog')).toBeHidden()
    expect(reviewsOf(backend, UCL)).toHaveLength(3)
  })

  test('confirming deletes it and brings the form back', async ({ page, backend }) => {
    await current(page).getByTestId('review-delete-btn').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(page.getByTestId('notice-success-message')).toHaveText('Your review was deleted successfully.')
    await expect(page.getByTestId('review-body-input')).toBeVisible()
    expect(reviewsOf(backend, UCL)).toHaveLength(2)
  })

  test('its comments go with it', async ({ page, backend }) => {
    backend.rows('review_comments').push({ id: 90, review_id: 50, user_id: backend.userByEmail('alex@seed.test').id, body: 'Nice', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    await page.reload()
    await current(page).getByTestId('review-delete-btn').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(page.getByTestId('review-body-input')).toBeVisible()
    expect(backend.rows('review_comments').filter((c) => c.review_id === 50)).toHaveLength(0)
  })

  test('shows an error and keeps the review when the delete fails', async ({ page, backend }) => {
    backend.fail('/rest/v1/university_reviews', { status: 500, body: { message: 'database is down' }, times: 1 })
    await current(page).getByTestId('review-delete-btn').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(page.getByTestId('review-action-error')).toContainText('database is down')
    expect(reviewsOf(backend, UCL)).toHaveLength(3)
  })
})

test.describe('reviews: comments', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openUniversity(page)
  })

  test('adds a comment to the review being shown', async ({ page, student, backend }) => {
    await current(page).getByTestId('comment-input').fill('Thanks for sharing')
    await current(page).getByTestId('comment-submit-btn').click()
    await expect(current(page).getByTestId('comment-item')).toContainText('Thanks for sharing')
    await expect(page.getByTestId('notice-success-message')).toHaveText('Your comment was posted successfully.')
    await expect(current(page).getByTestId('comment-input')).toHaveValue('')
    const [mine] = backend.rows('review_comments').filter((c) => c.user_id === student.id)
    expect(mine).toMatchObject({ review_id: 2, body: 'Thanks for sharing' })
    await page.reload()
    await expect(current(page).getByTestId('comment-item')).toContainText('Thanks for sharing')
  })

  test('ignores a comment that is only spaces', async ({ page, backend }) => {
    await current(page).getByTestId('comment-input').fill('    ')
    await current(page).getByTestId('comment-submit-btn').click()
    expect(backend.writes('review_comments')).toHaveLength(0)
  })

  test('the box stops at 500 characters', async ({ page }) => {
    await current(page).getByTestId('comment-input').fill('y'.repeat(600))
    await expect(current(page).getByTestId('comment-input')).toHaveValue('y'.repeat(500))
  })

  test('comment text is shown as text', async ({ page }) => {
    await current(page).getByTestId('comment-input').fill('<script>window.__x = 1</script><i>hi</i>')
    await current(page).getByTestId('comment-submit-btn').click()
    await expect(current(page).getByTestId('comment-item')).toContainText('<i>hi</i>')
    expect(await page.evaluate(() => window.__x)).toBeUndefined()
  })

  test('you can delete your own comment but not someone else\'s', async ({ page, backend }) => {
    await page.getByTestId('review-next-btn').click()
    await expect(current(page).getByTestId('comment-item')).toHaveCount(1)
    await expect(current(page).getByTestId('comment-delete-btn')).toHaveCount(0)
    await current(page).getByTestId('comment-input').fill('Mine')
    await current(page).getByTestId('comment-submit-btn').click()
    await expect(current(page).getByTestId('comment-item')).toHaveCount(2)
    await current(page).getByTestId('comment-delete-btn').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(current(page).getByTestId('comment-item')).toHaveCount(1)
    await expect(page.getByTestId('notice-success-message')).toHaveText('Your comment was deleted successfully.')
    expect(backend.rows('review_comments')).toHaveLength(1)
  })

  test('shows the error when the comment cannot be saved', async ({ page, backend }) => {
    backend.fail('/rest/v1/review_comments', { status: 500, body: { message: 'database is down' }, times: 1 })
    await current(page).getByTestId('comment-input').fill('Will fail')
    await current(page).getByTestId('comment-submit-btn').click()
    await expect(current(page).getByTestId('comment-error')).toContainText('database is down')
    await expect(current(page).getByTestId('comment-input')).toHaveValue('Will fail')
  })
})

test.describe('reviews: moderation by staff', () => {
  test.beforeEach(async ({ page, admin, backend }) => {
    await signIn(page, admin, backend)
    await openUniversity(page)
  })

  test('an admin can remove other students\' reviews, with a clear warning', async ({ page, backend }) => {
    await expect(current(page).getByTestId('review-remove-btn')).toBeVisible()
    await expect(current(page).getByTestId('review-edit-btn')).toHaveCount(0)
    await current(page).getByTestId('review-remove-btn').click()
    await expect(page.getByTestId('delete-confirm-dialog')).toContainText('Remove Student Review?')
    await expect(page.getByTestId('delete-confirm-dialog')).toContainText('the student will not be notified')
    await page.getByTestId('delete-confirm-action').click()
    await expect(page.getByTestId('notice-success-message')).toHaveText('The review was removed successfully.')
    expect(reviewsOf(backend, UCL)).toHaveLength(1)
  })

  test('an admin can remove a comment', async ({ page, backend }) => {
    await page.getByTestId('review-next-btn').click()
    await current(page).getByTestId('comment-remove-btn').click()
    await page.getByTestId('delete-confirm-action').click()
    await expect(page.getByTestId('notice-success-message')).toHaveText('The comment was removed successfully.')
    expect(backend.rows('review_comments')).toHaveLength(0)
  })

  test('previewing as a student takes the moderation buttons away', async ({ page }) => {
    await page.getByTestId('nav-toggle').click()
    await nav(page, 'nav-preview-toggle').click()
    await expect(page.getByTestId('review-remove-btn')).toHaveCount(0)
    await expect(page.getByTestId('comment-remove-btn')).toHaveCount(0)
  })
})

test.describe('reviews: two people at once', () => {
  test('a review posted by one shows up for the other on their next visit', async ({ page, student, backend, person }) => {
    await signIn(page, student, backend)
    await openUniversity(page)
    await post(page, 'Posted by the first student', 5)
    await expect(page.getByTestId('review-delete-btn')).toBeVisible()
    const other = await person(backend.userByEmail('bea@seed.test'))
    await other.goto(`/universities/${UCL}`)
    await expect(other.getByTestId('reviews-average')).toContainText('from 3 reviews')
    await expect(other.getByTestId('review-edit-btn')).toHaveCount(1) // Bea's own seeded review
    await expect(other.locator('.carousel-item.active')).toContainText('Posted by the first student')
  })

  test('a student cannot edit or delete another student\'s review through the API', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openUniversity(page)
    const outcome = await page.evaluate(async ({ key, url, anon }) => {
      const session = JSON.parse(localStorage.getItem(key))
      const headers = { apikey: anon, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
      const edit = await fetch(`${url}/rest/v1/university_reviews?id=eq.1`, { method: 'PATCH', headers, body: JSON.stringify({ review: 'hacked' }) })
      const remove = await fetch(`${url}/rest/v1/university_reviews?id=eq.1`, { method: 'DELETE', headers })
      return { edited: await edit.json(), removed: await remove.json() }
    }, { key: 'sb-mock-auth-token', url: 'https://mock.supabase.co', anon: 'mock-anon-key' })
    expect(outcome.edited).toEqual([])
    expect(outcome.removed).toEqual([])
    expect(backend.find('university_reviews', (r) => r.id === 1).review).toMatch(/^London was incredible/)
  })
})

test.describe('reviews: on a phone', () => {
  test.use({ viewport: { width: 375, height: 700 } })

  test('the form and carousel fit the screen', async ({ page, student, backend }) => {
    await signIn(page, student, backend)
    await openUniversity(page)
    await post(page, 'Phone sized review')
    await expect(page.getByTestId('review-delete-btn')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  })
})
