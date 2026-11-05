import { test, expect } from './support/fixtures.js'
import { idle, signIn, nav } from './support/ui.js'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const universitySelect = (page) => page.getByTestId('schedule-university-select')
const periodSelect = (page) => page.getByTestId('schedule-period-select')
const moduleTable = (page) => page.getByTestId('module-table')
const editButton = (page) => page.getByTestId('schedule-edit-toggle-btn')
const saveButton = (page) => moduleTable(page).getByRole('button', { name: 'Save', exact: true })
const cancelButton = (page) => moduleTable(page).getByRole('button', { name: 'Cancel', exact: true })

/** One half-hour cell of the timetable, e.g. cell(page, 'Tuesday', '09:30'). */
const cell = (page, day, time) =>
  page
    .locator('tbody tr')
    .filter({ has: page.locator('th.timing', { hasText: new RegExp(`^${time}$`) }) })
    .locator('td')
    .nth(DAYS.indexOf(day))

/** A module in the reference list, found by its code or name. */
const moduleRow = (page, text) => moduleTable(page).locator('.module-select-item').filter({ hasText: text })

/** The small remove button only shows when the slot is hovered. */
async function removeSlot(page, day, time) {
  await cell(page, day, time).hover()
  await cell(page, day, time).getByTitle('Remove Module Slot').click()
}

/** Picks the module, then the start and end cells. */
async function selectSlot(page, code, day, start, end) {
  await moduleRow(page, code).click()
  await cell(page, day, start).click()
  await cell(page, day, end).click()
}

async function addSlot(page, code, day, start, end) {
  await selectSlot(page, code, day, start, end)
  await page.getByRole('button', { name: 'Add Slot' }).click()
}

/** A saved timetable, written straight to the backend: lessons are { cart, day, start, end } with cart a cart row. */
function saveTimetable(backend, user, universityId, periodId, lessons = []) {
  const stamp = new Date().toISOString()
  const timetable = { id: backend.nextId('timetables'), user_id: user.id, university_id: universityId, exchange_period_id: periodId, created_at: stamp, updated_at: stamp }
  backend.rows('timetables').push(timetable)
  for (const l of lessons) {
    backend.rows('planned_modules').push({
      id: backend.nextId('planned_modules'), timetable_id: timetable.id, cart_module_id: l.cart.id, user_id: user.id, university_id: universityId,
      day_of_week: l.day, start_time: `${l.start}:00`, end_time: `${l.end}:00`, created_at: stamp, updated_at: stamp,
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

/** Clicks Save and waits for it to finish (the page goes back to view mode). */
async function saveSchedule(page) {
  await saveButton(page).click()
  await expect(editButton(page)).toBeVisible()
  await idle(page)
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

  test('shows only the chooser until a university is picked', async ({ page }) => {
    await openSchedule(page)
    await expect(universitySelect(page)).toHaveValue('')
    await expect(page.getByTestId('schedule-block')).toHaveCount(0)
    await expect(moduleTable(page)).toHaveCount(0)
  })

  test('offers shortlisted universities and ones with courses in the cart', async ({ page, student, backend }) => {
    backend.shortlist(student, [5])
    backend.fillCart(student, 2, ['Game Theory'])
    await openSchedule(page)
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

  test('picking a university shows its modules, with the grid locked until a period is chosen', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    backend.fillCart(student, 2, ['Game Theory'])
    await openSchedule(page)
    await universitySelect(page).selectOption({ label: 'Boston University' })
    await expect(page).toHaveURL(/\/schedule\/2$/)
    await expect(moduleTable(page)).toBeVisible()
    await expect(page.getByText('Exchange Period Required')).toBeVisible()
    await expect(periodSelect(page).locator('option')).toHaveCount(3) // "Choose a Period" and the two periods
  })

  test('choosing a period unlocks the grid and puts it in the address', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await openSchedule(page, '/schedule/2')
    const [fall] = periodsOf(backend, 2)
    await periodSelect(page).selectOption(String(fall.id))
    await expect(page).toHaveURL(new RegExp(`/schedule/2\\?period=${fall.id}$`))
    await expect(page.getByText('Exchange Period Required')).toHaveCount(0)
    await expect(page.getByText('View Mode')).toBeVisible()
  })

  test('opens straight to a period from a link', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    const [fall] = periodsOf(backend, 2)
    await openSchedule(page, `/schedule/2?period=${fall.id}`)
    await expect(universitySelect(page)).toHaveValue('2')
    await expect(periodSelect(page)).toHaveValue(String(fall.id))
  })

  test('marks the periods that already have a saved timetable', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    const [, spring] = periodsOf(backend, 2)
    saveTimetable(backend, student, 2, spring.id)
    await openSchedule(page, '/schedule/2')
    await expect(periodSelect(page).locator('option', { hasText: 'Spring 2027' })).toContainText('(Saved)')
    await expect(periodSelect(page).locator('option', { hasText: 'Fall 2026' })).not.toContainText('(Saved)')
  })

  test('falls back to a real period when the one in the link does not belong to the university', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await openSchedule(page, '/schedule/2?period=9999')
    const [fall] = periodsOf(backend, 2)
    await expect(page).toHaveURL(new RegExp(`period=${fall.id}$`))
  })
})

test.describe('schedule: planning a new timetable', () => {
  const COURSES = ['Game Theory', 'Business Valuation']
  let period

  test.beforeEach(async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    backend.fillCart(student, 2, COURSES)
    period = periodsOf(backend, 2)[0]
    await signIn(page, student, backend)
    await openSchedule(page, `/schedule/2?period=${period.id}`)
  })

  test('lists the modules from the cart, with a count', async ({ page }) => {
    await expect(moduleTable(page).getByRole('heading', { name: /Module Reference\s*2/ })).toBeVisible()
    await expect(moduleRow(page, 'Game Theory')).toContainText('CAS EC 403')
    await expect(moduleRow(page, 'Business Valuation')).toContainText('QST FE 448')
  })

  test('is read-only until you choose Edit Schedule', async ({ page }) => {
    await expect(page.getByText('View Mode')).toBeVisible()
    await cell(page, 'Monday', '09:00').click({ force: true })
    await expect(page.getByRole('button', { name: 'Add Slot' })).toHaveCount(0)
    await editButton(page).click()
    await expect(page.getByText('Editing Mode')).toBeVisible()
    await expect(saveButton(page)).toBeVisible()
    await expect(cancelButton(page)).toBeVisible()
  })

  test('shows a week from 08:00 to 18:00', async ({ page }) => {
    await expect(page.locator('tbody tr')).toHaveCount(21)
    await expect(page.locator('th.timing').first()).toHaveText('08:00')
    await expect(page.locator('th.timing').last()).toHaveText('18:00')
    await expect(page.getByRole('columnheader', { name: 'Friday' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Saturday' })).toHaveCount(0)
  })

  test('complains when you click a slot before choosing a module', async ({ page }) => {
    await editButton(page).click()
    await cell(page, 'Monday', '09:00').click()
    await expect(page.getByText('Select a module from Reference first')).toBeVisible()
  })

  test('selecting a module highlights it, and clicking it again unselects', async ({ page }) => {
    await editButton(page).click()
    await moduleRow(page, 'Game Theory').click()
    await expect(moduleRow(page, 'Game Theory')).toHaveClass(/is-selected/)
    await expect(page.getByText('Selected:')).toBeVisible()
    await moduleRow(page, 'Game Theory').click()
    await expect(moduleRow(page, 'Game Theory')).not.toHaveClass(/is-selected/)
  })

  test('shows your selection with its day and times', async ({ page }) => {
    await editButton(page).click()
    await selectSlot(page, 'Game Theory', 'Tuesday', '09:00', '10:30')
    await expect(page.getByText(/Tuesdays 09:00\s*[–-]\s*10:30/)).toBeVisible()
  })

  test('Cancel on the popup throws the selection away', async ({ page }) => {
    await editButton(page).click()
    await selectSlot(page, 'Game Theory', 'Tuesday', '09:00', '10:30')
    await page.locator('.floating-popover').getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Add Slot' })).toHaveCount(0)
    await expect(cell(page, 'Tuesday', '09:00')).not.toHaveClass(/blocked/)
  })

  test('Add Slot puts the lesson on the grid and marks the module as placed', async ({ page }) => {
    await editButton(page).click()
    await addSlot(page, 'Game Theory', 'Tuesday', '09:00', '10:30')
    await expect(cell(page, 'Tuesday', '09:00')).toContainText('CAS EC 403')
    for (const time of ['09:00', '09:30', '10:00', '10:30']) await expect(cell(page, 'Tuesday', time)).toHaveClass(/blocked/)
    await expect(cell(page, 'Tuesday', '11:00')).not.toHaveClass(/blocked/)
    await expect(cell(page, 'Wednesday', '09:00')).not.toHaveClass(/blocked/)
    await expect(moduleRow(page, 'Game Theory')).toContainText('Placed')
  })

  test('cannot start a lesson on top of another', async ({ page }) => {
    await editButton(page).click()
    await addSlot(page, 'Game Theory', 'Monday', '09:00', '10:00')
    await moduleRow(page, 'Business Valuation').click()
    await cell(page, 'Monday', '09:30').click()
    await expect(page.getByRole('button', { name: 'Add Slot' })).toHaveCount(0)
  })

  test('ignores an end slot on a different day or before the start', async ({ page }) => {
    await editButton(page).click()
    await moduleRow(page, 'Game Theory').click()
    await cell(page, 'Monday', '10:00').click()
    await cell(page, 'Tuesday', '11:00').click()
    await cell(page, 'Monday', '09:00').click()
    await expect(page.getByRole('button', { name: 'Add Slot' })).toHaveCount(0)
  })

  test('two modules can share a day', async ({ page }) => {
    await editButton(page).click()
    await addSlot(page, 'Game Theory', 'Monday', '09:00', '10:30')
    await addSlot(page, 'Business Valuation', 'Monday', '13:00', '14:30')
    await expect(cell(page, 'Monday', '09:00')).toContainText('CAS EC 403')
    await expect(cell(page, 'Monday', '13:00')).toContainText('QST FE 448')
  })

  test('a slot can be removed again before saving', async ({ page }) => {
    await editButton(page).click()
    await addSlot(page, 'Game Theory', 'Monday', '09:00', '10:30')
    await removeSlot(page, 'Monday', '09:00')
    await expect(cell(page, 'Monday', '09:00')).not.toHaveClass(/blocked/)
    await expect(moduleRow(page, 'Game Theory')).not.toContainText('Placed')
  })

  test('saving stores the timetable and its lessons for this student', async ({ page, student, backend }) => {
    await editButton(page).click()
    await addSlot(page, 'Game Theory', 'Tuesday', '09:00', '10:30')
    await saveSchedule(page)
    const [timetable] = timetablesOf(backend, student)
    expect(timetable).toMatchObject({ university_id: 2, exchange_period_id: period.id })
    const [lesson] = lessonsOf(backend, student)
    expect(lesson).toMatchObject({ timetable_id: timetable.id, university_id: 2, day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:30:00' })
    expect(backend.find('cart_modules', (c) => c.id === lesson.cart_module_id).university_module_id)
      .toBe(backend.find('university_modules', (m) => m.module_name === 'Game Theory').id)
    // back to a read-only view of what was saved
    await expect(page.getByText('View Mode')).toBeVisible()
    await expect(cell(page, 'Tuesday', '09:00')).toContainText('CAS EC 403')
    await expect(periodSelect(page).locator('option', { hasText: 'Fall 2026' })).toContainText('(Saved)')
  })

  test('a failed save shows the error and keeps the work', async ({ page, student, backend }) => {
    await editButton(page).click()
    await addSlot(page, 'Game Theory', 'Tuesday', '09:00', '10:30')
    backend.fail('/rest/v1/timetables', { status: 500, body: { message: 'database is down' }, times: 1 })
    await saveButton(page).click()
    await expect(page.getByText('database is down')).toBeVisible()
    await expect(cell(page, 'Tuesday', '09:00')).toContainText('CAS EC 403')
    expect(timetablesOf(backend, student)).toHaveLength(0)
  })

  test('Cancel discards an unsaved timetable', async ({ page, student, backend }) => {
    await editButton(page).click()
    await addSlot(page, 'Game Theory', 'Tuesday', '09:00', '10:30')
    await cancelButton(page).click()
    await expect(editButton(page)).toBeVisible()
    await expect(cell(page, 'Tuesday', '09:00')).not.toHaveClass(/blocked/)
    expect(timetablesOf(backend, student)).toHaveLength(0)
  })
})

test.describe('schedule: before a period is chosen', () => {
  test('the grid is locked, so nothing can be planned', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    backend.fillCart(student, 2, ['Game Theory'])
    await signIn(page, student, backend)
    await openSchedule(page, '/schedule/2')
    await expect(page.getByText('Exchange Period Required')).toBeVisible()
    await editButton(page).click()
    await moduleRow(page, 'Game Theory').click()
    await cell(page, 'Monday', '09:00').click({ force: true })
    await expect(page.getByRole('button', { name: 'Add Slot' })).toHaveCount(0)
  })
})

test.describe('schedule: a saved timetable', () => {
  let cart
  let fall
  let spring

  test.beforeEach(async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    cart = backend.fillCart(student, 2, ['Game Theory', 'Business Valuation'])
    ;[fall, spring] = periodsOf(backend, 2)
    saveTimetable(backend, student, 2, fall.id, [
      { cart: cart[0], day: 'Monday', start: '09:00', end: '10:30' },
      { cart: cart[1], day: 'Wednesday', start: '14:00', end: '15:30' },
    ])
    await signIn(page, student, backend)
    await openSchedule(page, `/schedule/2?period=${fall.id}`)
  })

  test('opens read-only with the lessons in place', async ({ page }) => {
    await expect(page.getByText('View Mode')).toBeVisible()
    await expect(cell(page, 'Monday', '09:00')).toContainText('CAS EC 403')
    await expect(cell(page, 'Monday', '10:30')).toHaveClass(/blocked/)
    await expect(cell(page, 'Wednesday', '14:00')).toContainText('QST FE 448')
    await expect(saveButton(page)).toHaveCount(0)
    await expect(moduleRow(page, 'Game Theory')).toContainText('Placed')
  })

  test('clicking the grid in view mode changes nothing', async ({ page }) => {
    await cell(page, 'Friday', '09:00').click({ force: true })
    await expect(cell(page, 'Friday', '09:00')).not.toHaveClass(/blocked/)
    await expect(page.getByRole('button', { name: 'Add Slot' })).toHaveCount(0)
  })

  test('Edit Schedule shows Save and Cancel, and the remove buttons', async ({ page }) => {
    await editButton(page).click()
    await expect(saveButton(page)).toBeVisible()
    await cell(page, 'Monday', '09:00').hover()
    await expect(cell(page, 'Monday', '09:00').getByTitle('Remove Module Slot')).toBeVisible()
  })

  test('moving a lesson (remove, then add it somewhere else) and saving updates the timetable', async ({ page, student, backend }) => {
    await editButton(page).click()
    await removeSlot(page, 'Wednesday', '14:00')
    await expect(cell(page, 'Wednesday', '14:00')).not.toHaveClass(/blocked/)
    await addSlot(page, 'Business Valuation', 'Thursday', '10:00', '11:30')
    await saveSchedule(page)
    expect(timetablesOf(backend, student)).toHaveLength(1)
    const lessons = lessonsOf(backend, student)
    expect(lessons).toHaveLength(2)
    expect(lessons.map((l) => l.day_of_week).sort()).toEqual(['Monday', 'Thursday'])
  })

  // Known gap: Save stays disabled after only removing a lesson, so a deletion on its own cannot be saved
  test.fixme('removing a lesson on its own can be saved', async ({ page, student, backend }) => {
    await editButton(page).click()
    await removeSlot(page, 'Wednesday', '14:00')
    await saveSchedule(page)
    expect(lessonsOf(backend, student)).toHaveLength(1)
  })

  test('clicking a placed lesson offers to remove it', async ({ page }) => {
    await editButton(page).click()
    await cell(page, 'Monday', '10:00').click()
    await expect(page.locator('.floating-popover')).toContainText('Game Theory')
    await page.getByRole('button', { name: 'Remove Slot' }).click()
    await expect(cell(page, 'Monday', '09:00')).not.toHaveClass(/blocked/)
  })

  test('adds another module to an existing timetable', async ({ page, student, backend }) => {
    backend.fillCart(student, 2, ['Derivatives Securities'])
    await page.reload()
    await editButton(page).click()
    await addSlot(page, 'Derivatives Securities', 'Friday', '11:00', '12:00')
    await saveSchedule(page)
    expect(timetablesOf(backend, student)).toHaveLength(1)
    expect(lessonsOf(backend, student)).toHaveLength(3)
  })

  test('a refused save shows the error and stays in edit mode', async ({ page, backend }) => {
    await editButton(page).click()
    await removeSlot(page, 'Wednesday', '14:00')
    await addSlot(page, 'Business Valuation', 'Thursday', '10:00', '11:30')
    backend.fail('/rest/v1/planned_modules', { status: 500, body: { message: 'database is down' }, times: 2 })
    await saveButton(page).click()
    await expect(page.getByText('database is down')).toBeVisible()
    await expect(saveButton(page)).toBeVisible()
  })

  test('Cancel brings back what was saved', async ({ page, student, backend }) => {
    await editButton(page).click()
    await removeSlot(page, 'Wednesday', '14:00')
    await expect(cell(page, 'Wednesday', '14:00')).not.toHaveClass(/blocked/)
    await cancelButton(page).click()
    await expect(editButton(page)).toBeVisible()
    await expect(cell(page, 'Wednesday', '14:00')).toContainText('QST FE 448')
    expect(lessonsOf(backend, student)).toHaveLength(2)
  })

  test('each exchange period has its own timetable', async ({ page }) => {
    await periodSelect(page).selectOption(String(spring.id))
    await expect(page).toHaveURL(new RegExp(`period=${spring.id}$`))
    await expect(cell(page, 'Monday', '09:00')).not.toHaveClass(/blocked/)
    await expect(moduleRow(page, 'Game Theory')).not.toContainText('Placed')
  })

  test('is private to the student', async ({ person, backend }) => {
    const other = backend.createUser()
    backend.shortlist(other, [2])
    const theirs = await person(other)
    await theirs.goto(`/schedule/2?period=${fall.id}`)
    await expect(theirs.getByTestId('schedule-block')).toBeVisible()
    await expect(theirs.locator('td.blocked')).toHaveCount(0)
  })

  test.describe('leaving with unsaved changes', () => {
    test.beforeEach(async ({ page }) => {
      await editButton(page).click()
      await removeSlot(page, 'Wednesday', '14:00')
      await expect(cell(page, 'Wednesday', '14:00')).not.toHaveClass(/blocked/)
    })

    const dialog = (page) => page.getByTestId('delete-confirm-dialog')

    test('asks before switching period, and stays if you decline', async ({ page }) => {
      await periodSelect(page).selectOption(String(spring.id))
      await expect(dialog(page)).toContainText('Discard Changes?')
      await expect(dialog(page)).toContainText('You have unsaved changes')
      await page.getByTestId('delete-confirm-cancel').click()
      await expect(page).toHaveURL(new RegExp(`period=${fall.id}$`))
      await expect(periodSelect(page)).toHaveValue(String(fall.id))
    })

    test('lets you go ahead and discards the changes', async ({ page, student, backend }) => {
      await periodSelect(page).selectOption(String(spring.id))
      await page.getByTestId('delete-confirm-action').click()
      await expect(page).toHaveURL(new RegExp(`period=${spring.id}$`))
      expect(lessonsOf(backend, student)).toHaveLength(2)
    })

    test('asks before leaving the page too', async ({ page }) => {
      await page.getByTestId('nav-toggle').click()
      await nav(page, 'nav-home').click()
      await expect(dialog(page)).toContainText('Discard Changes?')
      await page.getByTestId('delete-confirm-cancel').click()
      await expect(page).toHaveURL(/\/schedule\//)
    })
  })
})

test.describe('schedule: when there are no courses', () => {
  test('says there is nothing in the reference list yet', async ({ page, student, backend }) => {
    backend.shortlist(student, [2])
    await signIn(page, student, backend)
    const [fall] = periodsOf(backend, 2)
    await openSchedule(page, `/schedule/2?period=${fall.id}`)
    await expect(moduleTable(page)).toContainText('No modules added to reference yet.')
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
    await expect(moduleRow(page, 'Game Theory')).toContainText('CAS EC 403')
  })
})
