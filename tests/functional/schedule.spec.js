import { test, expect } from './support/fixtures.js'
import { idle, signIn } from './support/ui.js'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const universitySelect = (page) => page.getByTestId('schedule-university-select')
const periodSelect = (page) => page.getByTestId('schedule-period-select')

/** One half-hour cell of the timetable, e.g. cell(page, 'Tuesday', '09:30'). */
const cell = (page, day, time) =>
  page
    .locator('tbody#window tr')
    .filter({ has: page.locator('th.timing', { hasText: new RegExp(`^${time}$`) }) })
    .locator('td')
    .nth(DAYS.indexOf(day))

/** Picks the module by its code, then the start and end cells. */
async function selectSlot(page, code, day, start, end) {
  await page.locator('#instructionSelect').getByText(code, { exact: true }).click()
  await cell(page, day, start).click()
  await cell(page, day, end).click()
}

/** A saved timetable, written straight to the backend: lessons are { module, day, start, end } with module a cart row. */
function saveTimetable(backend, user, universityId, periodId, lessons = []) {
  const timetable = { id: backend.nextId('timetables'), user_id: user.id, university_id: universityId, exchange_period_id: periodId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  backend.rows('timetables').push(timetable)
  for (const l of lessons) {
    backend.rows('planned_modules').push({
      id: backend.nextId('planned_modules'), timetable_id: timetable.id, cart_module_id: l.cart.id, user_id: user.id, university_id: universityId,
      day_of_week: l.day, start_time: `${l.start}:00`, end_time: `${l.end}:00`, created_at: timetable.created_at, updated_at: timetable.created_at,
    })
  }
  return timetable
}

const periodsOf = (backend, universityId) => backend.rows('exchange_periods').filter((p) => p.university_id === universityId)
const timetablesOf = (backend, user) => backend.rows('timetables').filter((t) => t.user_id === user.id)
const lessonsOf = (backend, user) => backend.rows('planned_modules').filter((p) => p.user_id === user.id)

async function openSchedule(page, path = '/schedule') {
  await page.goto(path)
  await expect(page.getByTestId('schedule-page')).toBeVisible()
  await expect(page.getByTestId('schedule-loading')).toBeHidden()
  await idle(page)
}

/** The instruction panels ("Delete Modules", "Insert/Update Modules") start folded away on a saved timetable. */
async function unfold(page, title) {
  await page.getByRole('heading', { name: title }).click()
}

/** Clicks Save and waits for it to finish (the button reads "Saving..." in between, then goes away). */
async function saveSchedule(page) {
  await page.getByRole('button', { name: 'Save Schedule' }).click()
  await expect(page.getByRole('button', { name: /Sav(e|ing)/ })).toHaveCount(0)
  await idle(page)
}

async function startNewSchedule(page) {
  await page.getByTestId('schedule-create-button').click()
  await expect(page.getByTestId('schedule-block')).toBeVisible({ timeout: 5000 })
}

test.describe('schedule: access', () => {
  test('sends a logged-out visitor to log in and back', async ({ page }) => {
    await page.goto('/schedule/2')
    await expect(page).toHaveURL(/\/login/)
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/schedule/2')
  })
})

test.describe('schedule: choosing what to plan', () => {
  test.beforeEach(async ({ page, student, backend }) => {
    await signIn(page, student, backend)
  })

  test('points to shortlisting or the cart when there is nothing to plan yet', async ({ page }) => {
    await openSchedule(page)
    await expect(page.getByTestId('schedule-no-universities')).toContainText('Shortlist a Partner University')
    await page.getByTestId('schedule-no-universities').getByRole('link', { name: 'Add Courses to Your Cart' }).click()
    await expect(page).toHaveURL(/\/courses$/)
  })

  test('offers shortlisted universities and ones with courses in the cart', async ({ page, student, backend }) => {
    backend.shortlist(student, [5])
    backend.fillCart(student, 2, ['Game Theory'])
    await openSchedule(page)
    await expect(page.getByTestId('schedule-choose-university')).toBeVisible()
    const options = await universitySelect(page).locator('option').allInnerTexts()
    expect(options).toEqual(['Choose a University', 'Boston University', 'Kyoto University'])
  })

  test('does not offer a university that has been hidden', async ({ page, student, backend }) => {
    backend.shortlist(student, [5, 2])
    backend.find('universities', (u) => u.id === 5).published = false
    await openSchedule(page)
    const options = await universitySelect(page).locator('option').allInnerTexts()
    expect(options).not.toContain('Kyoto University')
  })

  test('opens the earliest exchange period when a university is chosen', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await openSchedule(page)
    await universitySelect(page).selectOption({ label: 'Boston University' })
    const [fall] = periodsOf(backend, 2)
    await expect(page).toHaveURL(new RegExp(`/schedule/2\\?period=${fall.id}$`))
    await expect(periodSelect(page).locator('option')).toHaveCount(2)
    await expect(page.getByRole('heading', { name: 'Weekly Schedule' })).toBeVisible()
    await expect(page.getByText('Boston University', { exact: true }).first()).toBeVisible()
  })

  test('opens straight to a university from a link, e.g. from the shortlist', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await openSchedule(page, '/schedule/2')
    await expect(page).toHaveURL(/\/schedule\/2\?period=\d+$/)
    await expect(universitySelect(page)).toHaveValue('2')
  })

  test('prefers a period that already has a saved timetable', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    const [, spring] = periodsOf(backend, 2)
    saveTimetable(backend, student, 2, spring.id)
    await openSchedule(page, '/schedule/2')
    await expect(page).toHaveURL(new RegExp(`period=${spring.id}$`))
    await expect(periodSelect(page).locator('option', { hasText: 'Spring 2027' })).toContainText('saved')
    await expect(periodSelect(page).locator('option', { hasText: 'Fall 2026' })).not.toContainText('saved')
  })

  test('falls back to the first period for a period that does not belong to the university', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await openSchedule(page, '/schedule/2?period=9999')
    const [fall] = periodsOf(backend, 2)
    await expect(page).toHaveURL(new RegExp(`period=${fall.id}$`))
  })
})

test.describe('schedule: planning a new timetable', () => {
  const COURSES = ['Game Theory', 'Business Valuation']

  test.beforeEach(async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    backend.fillCart(student, 2, COURSES)
    await signIn(page, student, backend)
    await openSchedule(page, '/schedule/2')
  })

  test('invites you to start, and tells you how many modules are available', async ({ page }) => {
    await expect(page.getByText(/no schedules planned for this university/)).toBeVisible()
    await expect(page.getByTestId('schedule-module-count')).toHaveText('2 modules are available from your cart and saved schedule.')
  })

  test('opens an editable week from 08:00 to 18:00', async ({ page }) => {
    await startNewSchedule(page)
    await expect(page.locator('tbody#window tr')).toHaveCount(21)
    await expect(page.locator('th.timing').first()).toHaveText('08:00')
    await expect(page.locator('th.timing').last()).toHaveText('18:00')
    await expect(page.getByRole('columnheader', { name: 'Friday' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Saturday' })).toHaveCount(0)
  })

  test('lists the cart\'s modules to choose from, and a link to add more', async ({ page }) => {
    await startNewSchedule(page)
    const chooser = page.locator('#instructionSelect')
    await expect(chooser.getByText('CAS EC 403')).toBeVisible()
    await expect(chooser.getByText('QST FE 448')).toBeVisible()
    await chooser.getByTestId('schedule-add-courses-link').click()
    await expect(page).toHaveURL(/\/courses\?university=2$/)
  })

  test('complains when you click a slot before choosing a module', async ({ page }) => {
    await startNewSchedule(page)
    await cell(page, 'Monday', '09:00').click()
    await expect(page.getByText('No module selected')).toBeVisible()
    await expect(page.getByText('Current selection')).toHaveCount(0)
  })

  test('shows your selection with its day and times', async ({ page }) => {
    await startNewSchedule(page)
    await selectSlot(page, 'CAS EC 403', 'Tuesday', '09:00', '10:30')
    await expect(page.getByText('Current selection')).toBeVisible()
    await expect(page.getByText('Tuesdays 09:00 - 10:30')).toBeVisible()
  })

  test('Clear throws the selection away', async ({ page }) => {
    await startNewSchedule(page)
    await selectSlot(page, 'CAS EC 403', 'Tuesday', '09:00', '10:30')
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByText('Current selection')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save Schedule' })).toHaveCount(0)
  })

  test('Add puts the lesson on the grid and offers to save or discard', async ({ page }) => {
    await startNewSchedule(page)
    await selectSlot(page, 'CAS EC 403', 'Tuesday', '09:00', '10:30')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(cell(page, 'Tuesday', '09:00')).toHaveText('CAS EC 403')
    for (const time of ['09:00', '09:30', '10:00', '10:30']) await expect(cell(page, 'Tuesday', time)).toHaveClass(/blocked/)
    await expect(cell(page, 'Tuesday', '11:00')).not.toHaveClass(/blocked/)
    await expect(cell(page, 'Wednesday', '09:00')).not.toHaveClass(/blocked/)
    await expect(page.getByRole('button', { name: 'Save Schedule' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Discard Changes' })).toBeVisible()
  })

  test('cannot start a lesson on top of another', async ({ page }) => {
    await startNewSchedule(page)
    await selectSlot(page, 'CAS EC 403', 'Monday', '09:00', '10:00')
    await page.getByRole('button', { name: 'Add' }).click()
    await page.locator('#instructionSelect').getByText('QST FE 448', { exact: true }).click()
    await cell(page, 'Monday', '09:30').click()
    await expect(page.getByText('Current selection')).toHaveCount(0)
  })

  test('ignores an end slot on a different day or before the start', async ({ page }) => {
    await startNewSchedule(page)
    await page.locator('#instructionSelect').getByText('CAS EC 403', { exact: true }).click()
    await cell(page, 'Monday', '10:00').click()
    await cell(page, 'Tuesday', '11:00').click()
    await cell(page, 'Monday', '09:00').click()
    await expect(page.getByText('Current selection')).toHaveCount(0)
  })

  test('two modules can share a day', async ({ page }) => {
    await startNewSchedule(page)
    await selectSlot(page, 'CAS EC 403', 'Monday', '09:00', '10:30')
    await page.getByRole('button', { name: 'Add' }).click()
    await selectSlot(page, 'QST FE 448', 'Monday', '13:00', '14:30')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(cell(page, 'Monday', '09:00')).toHaveText('CAS EC 403')
    await expect(cell(page, 'Monday', '13:00')).toHaveText('QST FE 448')
  })

  test('saving stores the timetable and its lessons for this student', async ({ page, student, backend }) => {
    await startNewSchedule(page)
    await selectSlot(page, 'CAS EC 403', 'Tuesday', '09:00', '10:30')
    await page.getByRole('button', { name: 'Add' }).click()
    await saveSchedule(page)
    const [fall] = periodsOf(backend, 2)
    const [timetable] = timetablesOf(backend, student)
    expect(timetable).toMatchObject({ university_id: 2, exchange_period_id: fall.id })
    const [lesson] = lessonsOf(backend, student)
    expect(lesson).toMatchObject({ timetable_id: timetable.id, university_id: 2, day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:30:00' })
    expect(backend.find('cart_modules', (c) => c.id === lesson.cart_module_id).university_module_id)
      .toBe(backend.find('university_modules', (m) => m.module_name === 'Game Theory').id)
    // back to a read-only view of what was saved
    await expect(page.getByRole('button', { name: 'Save Schedule' })).toHaveCount(0)
    await expect(cell(page, 'Tuesday', '09:00')).toHaveText('CAS EC 403')
    await expect(periodSelect(page).locator('option').first()).toContainText('saved')
  })

  // Known gap: save() sets `saved`, then reloads the timetable, and that reload clears it again
  test.fixme('confirms with "Schedule saved." after saving', async ({ page }) => {
    await startNewSchedule(page)
    await selectSlot(page, 'CAS EC 403', 'Tuesday', '09:00', '10:30')
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('button', { name: 'Save Schedule' }).click()
    await expect(page.getByTestId('schedule-saved')).toHaveText('Schedule saved.')
  })

  test('a failed save shows the error and keeps the work', async ({ page, student, backend }) => {
    await startNewSchedule(page)
    await selectSlot(page, 'CAS EC 403', 'Tuesday', '09:00', '10:30')
    await page.getByRole('button', { name: 'Add' }).click()
    backend.fail('/rest/v1/timetables', { status: 500, body: { message: 'database is down' }, times: 1 })
    await page.getByRole('button', { name: 'Save Schedule' }).click()
    await expect(page.getByTestId('schedule-error')).toContainText('database is down')
    await expect(page.getByTestId('schedule-saved')).toHaveCount(0)
    await expect(cell(page, 'Tuesday', '09:00')).toHaveText('CAS EC 403')
    expect(timetablesOf(backend, student)).toHaveLength(0)
  })

  test('Discard Changes empties an unsaved timetable', async ({ page, student, backend }) => {
    await startNewSchedule(page)
    await selectSlot(page, 'CAS EC 403', 'Tuesday', '09:00', '10:30')
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('button', { name: 'Discard Changes' }).click()
    await expect(page.getByRole('button', { name: 'Save Schedule' })).toHaveCount(0)
    await expect(cell(page, 'Tuesday', '09:00')).not.toHaveClass(/blocked/)
    expect(timetablesOf(backend, student)).toHaveLength(0)
  })
})

test.describe('schedule: a saved timetable', () => {
  let cart

  test.beforeEach(async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    cart = backend.fillCart(student, 2, ['Game Theory', 'Business Valuation'])
    const [fall] = periodsOf(backend, 2)
    saveTimetable(backend, student, 2, fall.id, [
      { cart: cart[0], day: 'Monday', start: '09:00', end: '10:30' },
      { cart: cart[1], day: 'Wednesday', start: '14:00', end: '15:30' },
    ])
    await signIn(page, student, backend)
    await openSchedule(page, '/schedule/2')
  })

  test('opens read-only with the lessons in place', async ({ page }) => {
    await expect(page.getByTestId('schedule-view-mode')).toBeChecked()
    await expect(cell(page, 'Monday', '09:00')).toHaveText('CAS EC 403')
    await expect(cell(page, 'Monday', '10:30')).toHaveClass(/blocked/)
    await expect(cell(page, 'Wednesday', '14:00')).toHaveText('QST FE 448')
    await expect(page.getByRole('button', { name: 'Save Schedule' })).toHaveCount(0)
  })

  test('clicking the grid in view mode changes nothing', async ({ page }) => {
    await cell(page, 'Friday', '09:00').click({ force: true })
    await expect(cell(page, 'Friday', '09:00')).not.toHaveClass(/blocked/)
    await expect(page.getByText('Current selection')).toHaveCount(0)
  })

  test('Edit Schedule shows the delete and update controls', async ({ page }) => {
    await page.locator('label[for="edit"]').click()
    await expect(page.getByTestId('schedule-edit-mode')).toBeChecked()
    await unfold(page, 'Delete Modules')
    await expect(page.getByRole('button', { name: 'Delete from Schedule' })).toBeVisible()
    await page.locator('label[for="view"]').click()
    await expect(page.getByRole('button', { name: 'Delete from Schedule' })).toHaveCount(0)
  })

  test('removes a module and saves the change', async ({ page, student, backend }) => {
    await page.locator('label[for="edit"]').click()
    await unfold(page, 'Delete Modules')
    await page.getByRole('checkbox', { name: 'QST FE 448' }).check()
    await page.getByRole('button', { name: 'Delete from Schedule' }).click()
    await expect(cell(page, 'Wednesday', '14:00')).not.toHaveClass(/blocked/)
    await saveSchedule(page)
    expect(timetablesOf(backend, student)).toHaveLength(1)
    const lessons = lessonsOf(backend, student)
    expect(lessons).toHaveLength(1)
    expect(lessons[0]).toMatchObject({ day_of_week: 'Monday', start_time: '09:00:00' })
  })

  test('adds another module to an existing timetable', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, ['Derivatives Securities'])
    await page.reload()
    await page.locator('label[for="edit"]').click()
    await unfold(page, 'Insert/Update Modules')
    await selectSlot(page, 'QST FE 430', 'Friday', '11:00', '12:00')
    await page.getByRole('button', { name: 'Add' }).click()
    await saveSchedule(page)
    expect(timetablesOf(backend, student)).toHaveLength(1)
    expect(lessonsOf(backend, student)).toHaveLength(3)
  })

  test('a module can only be placed once per timetable; a second slot is refused on save', async ({ page, student, backend }) => {
    await page.locator('label[for="edit"]').click()
    await unfold(page, 'Insert/Update Modules')
    await selectSlot(page, 'CAS EC 403', 'Friday', '11:00', '12:00')
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('button', { name: 'Save Schedule' }).click()
    await expect(page.getByTestId('schedule-error')).toBeVisible()
    await idle(page)
    expect(lessonsOf(backend, student).filter((l) => l.day_of_week === 'Friday')).toHaveLength(0)
  })

  test('a refused save leaves the saved lessons as they were', async ({ page, student, backend }) => {
    await page.locator('label[for="edit"]').click()
    await unfold(page, 'Insert/Update Modules')
    await selectSlot(page, 'CAS EC 403', 'Friday', '11:00', '12:00')
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('button', { name: 'Save Schedule' }).click()
    await expect(page.getByTestId('schedule-error')).toBeVisible()
    await idle(page)
    expect(lessonsOf(backend, student)).toHaveLength(2)
  })

  test('Discard Changes brings back what was saved', async ({ page, student, backend }) => {
    await page.locator('label[for="edit"]').click()
    await unfold(page, 'Delete Modules')
    await page.getByRole('checkbox', { name: 'QST FE 448' }).check()
    await page.getByRole('button', { name: 'Delete from Schedule' }).click()
    await expect(cell(page, 'Wednesday', '14:00')).not.toHaveClass(/blocked/)
    await page.getByRole('button', { name: 'Discard Changes' }).click()
    await expect(cell(page, 'Wednesday', '14:00')).toHaveText('QST FE 448')
    expect(lessonsOf(backend, student)).toHaveLength(2)
  })

  test('only modules already on the timetable can be ticked for deletion', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, ['Derivatives Securities'])
    await page.reload()
    await page.locator('label[for="edit"]').click()
    await unfold(page, 'Delete Modules')
    await expect(page.getByRole('checkbox', { name: 'QST FE 430' })).toBeDisabled()
    await expect(page.getByRole('checkbox', { name: 'CAS EC 403' })).toBeEnabled()
  })

  test('each exchange period has its own timetable', async ({ page, backend }) => {
    const [, spring] = periodsOf(backend, 2)
    await periodSelect(page).selectOption(String(spring.id))
    await expect(page).toHaveURL(new RegExp(`period=${spring.id}$`))
    await expect(page.getByText(/no schedules planned/)).toBeVisible()
    await expect(cell(page, 'Monday', '09:00')).toHaveCount(0)
  })

  test('is private to the student', async ({ person, backend }) => {
    const other = backend.createUser()
    backend.shortlist(other, [2])
    const theirs = await person(other)
    await theirs.goto('/schedule/2')
    await expect(theirs.getByText(/no schedules planned/)).toBeVisible()
  })

  test.describe('leaving with unsaved changes', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('label[for="edit"]').click()
      await unfold(page, 'Delete Modules')
      await page.getByRole('checkbox', { name: 'QST FE 448' }).check()
      await page.getByRole('button', { name: 'Delete from Schedule' }).click()
      await expect(page.getByRole('button', { name: 'Save Schedule' })).toBeVisible()
    })

    test('asks before switching period, and stays if you decline', async ({ page, backend }) => {
      const [fall, spring] = periodsOf(backend, 2)
      let asked = ''
      page.once('dialog', async (dialog) => { asked = dialog.message(); await dialog.dismiss() })
      await periodSelect(page).selectOption(String(spring.id))
      await expect.poll(() => asked).toContain('unsaved changes')
      await expect(page).toHaveURL(new RegExp(`period=${fall.id}$`))
      await expect(periodSelect(page)).toHaveValue(String(fall.id))
      await expect(page.getByRole('button', { name: 'Save Schedule' })).toBeVisible()
    })

    test('lets you go ahead and discards the changes', async ({ page, student, backend }) => {
      const [, spring] = periodsOf(backend, 2)
      page.once('dialog', (dialog) => dialog.accept())
      await periodSelect(page).selectOption(String(spring.id))
      await expect(page).toHaveURL(new RegExp(`period=${spring.id}$`))
      expect(lessonsOf(backend, student)).toHaveLength(2)
    })

    test('asks before leaving the page too', async ({ page }) => {
      let asked = false
      page.once('dialog', async (dialog) => { asked = true; await dialog.dismiss() })
      await page.getByTestId('nav-toggle').click()
      await page.getByTestId('nav-home').click()
      await expect.poll(() => asked).toBe(true)
      await expect(page).toHaveURL(/\/schedule\//)
    })
  })
})

test.describe('schedule: when there are no courses', () => {
  test('explains that the cart is empty and links to course search', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await signIn(page, student, backend)
    await openSchedule(page, '/schedule/2')
    await startNewSchedule(page)
    await expect(page.getByTestId('schedule-no-modules')).toContainText('No modules in your cart for this university yet')
    await page.getByTestId('schedule-add-courses-link').click()
    await expect(page).toHaveURL(/\/courses\?university=2$/)
  })
})

test.describe('schedule: connected to the course cart', () => {
  test('courses added in course search show up here', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await signIn(page, student, backend)
    await page.goto('/courses?university=2&area=3')
    await expect(page.getByTestId('course-module-item').first()).toBeVisible()
    await page.getByTestId('course-module-item').filter({ hasText: 'Game Theory' }).getByTestId('course-add-btn').click()
    await expect(page.getByTestId('course-cart-count')).toHaveText('1')
    await page.getByTestId('course-cart-schedule-link').click()
    await expect(page).toHaveURL(/\/schedule\/2/)
    await expect(page.getByTestId('schedule-module-count')).toContainText('1 module are available')
  })
})
