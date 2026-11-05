// The shape of the database as the app sees it: columns that need converting, defaults,
// foreign keys, unique rules and checks. It mirrors supabase/schema.sql, so a rule broken
// here fails the same way it would in Postgres.

const blank = (value) => value === null || value === undefined || value === ''
const text = (value) => String(value ?? '')
const within = (value, low, high) => blank(value) || (Number(value) >= low && Number(value) <= high)
const nonNegative = (...columns) => (row) => columns.every((c) => blank(row[c]) || Number(row[c]) >= 0)

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const TABLES = {
  universities: {
    int: [],
    num: ['lat', 'long'],
    defaults: { published: true },
    required: ['name', 'country', 'region'],
    unique: [{ name: 'universities_name_country_key', columns: ['name', 'country'], caseInsensitive: true }],
    checks: [
      ['universities_lat_check', (r) => within(r.lat, -90, 90)],
      ['universities_long_check', (r) => within(r.long, -180, 180)],
    ],
  },
  university_languages: {
    required: ['university_id', 'instruction_language'],
    fks: [{ column: 'university_id', table: 'universities', onDelete: 'cascade' }],
    unique: [{ name: 'university_languages_university_id_instruction_language_key', columns: ['university_id', 'instruction_language'] }],
  },
  exchange_periods: {
    int: ['min_temperature', 'max_temperature'],
    required: ['university_id', 'period_name'],
    fks: [{ column: 'university_id', table: 'universities', onDelete: 'cascade' }],
    checks: [
      ['exchange_periods_check', (r) => blank(r.start_date) || blank(r.end_date) || r.end_date >= r.start_date],
      ['exchange_periods_check1', (r) => blank(r.min_temperature) || blank(r.max_temperature) || Number(r.max_temperature) >= Number(r.min_temperature)],
    ],
  },
  university_costs: {
    num: ['accommodation', 'food', 'transport', 'personal_expenses', 'other_expenses'],
    required: ['university_id', 'currency_code'],
    fks: [{ column: 'university_id', table: 'universities', onDelete: 'cascade' }],
    unique: [{ name: 'university_costs_university_id_key', columns: ['university_id'] }],
    checks: [
      ['university_costs_currency_code_check', (r) => text(r.currency_code).length === 3],
      ['university_costs_amount_check', nonNegative('accommodation', 'food', 'transport', 'personal_expenses', 'other_expenses')],
    ],
  },
  smu_modules: {
    required: ['course_area'],
    unique: [{ name: 'smu_modules_course_area_key', columns: ['course_area'] }],
  },
  university_modules: {
    required: ['university_id', 'module_code', 'module_name'],
    fks: [{ column: 'university_id', table: 'universities', onDelete: 'cascade' }],
    unique: [{ name: 'university_modules_university_id_module_code_key', columns: ['university_id', 'module_code'] }],
  },
  credit_mappings: {
    required: ['smu_module_id', 'university_module_id'],
    fks: [
      { column: 'smu_module_id', table: 'smu_modules', onDelete: 'cascade' },
      { column: 'university_module_id', table: 'university_modules', onDelete: 'cascade' },
    ],
    unique: [{ name: 'credit_mappings_smu_module_id_university_module_id_key', columns: ['smu_module_id', 'university_module_id'] }],
  },
  shortlists: {
    required: ['user_id', 'university_id'],
    fks: [
      { column: 'user_id', table: 'auth.users', onDelete: 'cascade' },
      { column: 'university_id', table: 'universities', onDelete: 'cascade' },
    ],
    unique: [{ name: 'shortlists_user_id_university_id_key', columns: ['user_id', 'university_id'] }],
  },
  user_budgets: {
    int: ['duration_months'],
    num: ['total_budget', 'accommodation_budget', 'food_budget', 'transport_budget', 'personal_budget', 'other_budget'],
    defaults: { currency_code: 'SGD' },
    required: ['user_id', 'university_id', 'currency_code'],
    fks: [
      { column: 'user_id', table: 'auth.users', onDelete: 'cascade' },
      { column: 'university_id', table: 'universities', onDelete: 'cascade' },
      { column: 'exchange_period_id', table: 'exchange_periods', onDelete: 'setnull' },
    ],
    unique: [{ name: 'user_budgets_user_id_university_id_key', columns: ['user_id', 'university_id'] }],
    checks: [
      ['user_budgets_duration_months_check', (r) => blank(r.duration_months) || Number(r.duration_months) > 0],
      ['user_budgets_currency_code_check', (r) => text(r.currency_code).length === 3],
      ['user_budgets_amount_check', nonNegative('total_budget', 'accommodation_budget', 'food_budget', 'transport_budget', 'personal_budget', 'other_budget')],
    ],
  },
  university_reviews: {
    int: ['rating', 'academics_rating', 'accommodation_rating', 'cost_rating', 'campus_rating'],
    required: ['user_id', 'university_id', 'rating'],
    fks: [
      { column: 'user_id', table: 'auth.users', onDelete: 'cascade' },
      { column: 'university_id', table: 'universities', onDelete: 'cascade' },
      { column: 'exchange_period_id', table: 'exchange_periods', onDelete: 'setnull' },
    ],
    unique: [{ name: 'university_reviews_user_id_university_id_key', columns: ['user_id', 'university_id'] }],
    checks: [
      ['university_reviews_rating_check', (r) => within(r.rating, 1, 5)],
      ['university_reviews_academics_rating_check', (r) => within(r.academics_rating, 1, 5)],
      ['university_reviews_accommodation_rating_check', (r) => within(r.accommodation_rating, 1, 5)],
      ['university_reviews_cost_rating_check', (r) => within(r.cost_rating, 1, 5)],
      ['university_reviews_campus_rating_check', (r) => within(r.campus_rating, 1, 5)],
      ['university_reviews_review_check', (r) => text(r.review).length <= 2000],
    ],
  },
  review_comments: {
    required: ['review_id', 'user_id', 'body'],
    fks: [
      { column: 'review_id', table: 'university_reviews', onDelete: 'cascade' },
      { column: 'user_id', table: 'auth.users', onDelete: 'cascade' },
    ],
    checks: [['review_comments_body_check', (r) => text(r.body).trim().length >= 1 && text(r.body).trim().length <= 500]],
  },
  timetables: {
    int: ['exchange_period_id'],
    required: ['user_id', 'university_id', 'exchange_period_id'],
    fks: [
      { column: 'user_id', table: 'auth.users', onDelete: 'cascade' },
      { column: 'university_id', table: 'universities', onDelete: 'cascade' },
      { column: 'exchange_period_id', table: 'exchange_periods', onDelete: 'cascade' },
    ],
    unique: [{ name: 'timetables_user_id_university_id_exchange_period_id_key', columns: ['user_id', 'university_id', 'exchange_period_id'] }],
  },
  cart_modules: {
    required: ['user_id', 'university_id', 'university_module_id'],
    fks: [
      { column: 'user_id', table: 'auth.users', onDelete: 'cascade' },
      { column: 'university_id', table: 'universities', onDelete: 'cascade' },
      { column: 'university_module_id', table: 'university_modules', onDelete: 'cascade' },
    ],
    unique: [{ name: 'cart_modules_user_id_university_id_university_module_id_key', columns: ['user_id', 'university_id', 'university_module_id'] }],
  },
  planned_modules: {
    required: ['timetable_id', 'cart_module_id', 'user_id', 'university_id', 'day_of_week', 'start_time', 'end_time'],
    fks: [
      { column: 'timetable_id', table: 'timetables', onDelete: 'cascade' },
      { column: 'cart_module_id', table: 'cart_modules', onDelete: 'cascade' },
      { column: 'user_id', table: 'auth.users', onDelete: 'cascade' },
      { column: 'university_id', table: 'universities', onDelete: 'cascade' },
    ],
    unique: [{ name: 'planned_modules_timetable_id_cart_module_id_key', columns: ['timetable_id', 'cart_module_id'] }],
    checks: [
      ['planned_modules_day_of_week_check', (r) => DAYS.includes(r.day_of_week)],
      ['planned_modules_check', (r) => text(r.end_time) > text(r.start_time)],
    ],
  },
}

export const TABLE_NAMES = Object.keys(TABLES)

// tables whose rows carry updated_at (a trigger refreshes it on every update)
export const HAS_UPDATED_AT = new Set(TABLE_NAMES.filter((t) => t !== 'university_languages' && t !== 'shortlists' && t !== 'cart_modules'))

/**
 * How `parent` and `other` are related, the way PostgREST works it out from foreign keys.
 * Returns { kind: 'many' | 'one', parentColumn, otherColumn } or null.
 */
export function relationBetween(parent, other) {
  const toParent = (TABLES[other]?.fks ?? []).find((fk) => fk.table === parent)
  if (toParent) {
    const unique = (TABLES[other].unique ?? []).some((u) => u.columns.length === 1 && u.columns[0] === toParent.column)
    return { kind: unique ? 'one' : 'many', parentColumn: 'id', otherColumn: toParent.column }
  }
  const toOther = (TABLES[parent]?.fks ?? []).find((fk) => fk.table === other)
  if (toOther) return { kind: 'one', parentColumn: toOther.column, otherColumn: 'id' }
  return null
}
