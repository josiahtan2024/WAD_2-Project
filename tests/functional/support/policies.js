// Row level security, as written in supabase/policies.sql and supabase/admin.sql.
// ctx is { userId, isAdmin }; userId is null for a visitor.

const ADMIN_MANAGED = new Set([
  'universities', 'university_languages', 'exchange_periods', 'university_costs',
  'university_modules', 'credit_mappings', 'smu_modules',
])
const OWN_ROWS = new Set(['shortlists', 'user_budgets', 'timetables', 'cart_modules', 'planned_modules'])

function universityVisible(db, universityId, ctx) {
  const university = db.rows('universities').find((u) => u.id === Number(universityId))
  return !!university && (university.published !== false || ctx.isAdmin)
}

export function canSelect(db, table, row, ctx) {
  if (table === 'universities') return row.published !== false || ctx.isAdmin
  if (['university_languages', 'exchange_periods', 'university_costs', 'university_modules', 'university_reviews'].includes(table)) {
    return universityVisible(db, row.university_id, ctx)
  }
  if (table === 'credit_mappings') {
    const module = db.rows('university_modules').find((m) => m.id === row.university_module_id)
    return !!module && universityVisible(db, module.university_id, ctx)
  }
  if (table === 'review_comments') {
    const review = db.rows('university_reviews').find((r) => r.id === row.review_id)
    return !!review && universityVisible(db, review.university_id, ctx)
  }
  if (table === 'smu_modules') return true
  if (OWN_ROWS.has(table)) return !!ctx.userId && row.user_id === ctx.userId
  return false
}

export function canInsert(db, table, row, ctx) {
  if (ADMIN_MANAGED.has(table)) return ctx.isAdmin
  return !!ctx.userId && row.user_id === ctx.userId
}

export function canUpdate(db, table, oldRow, newRow, ctx) {
  if (!canSelect(db, table, oldRow, ctx)) return false
  if (ADMIN_MANAGED.has(table)) return ctx.isAdmin
  return !!ctx.userId && oldRow.user_id === ctx.userId && newRow.user_id === ctx.userId
}

export function canDelete(db, table, row, ctx) {
  if (!canSelect(db, table, row, ctx)) return false
  if (table === 'universities') return ctx.isAdmin && row.published === false
  if (ADMIN_MANAGED.has(table)) return ctx.isAdmin
  if (table === 'university_reviews' || table === 'review_comments') return ctx.isAdmin || (!!ctx.userId && row.user_id === ctx.userId)
  return !!ctx.userId && row.user_id === ctx.userId
}
