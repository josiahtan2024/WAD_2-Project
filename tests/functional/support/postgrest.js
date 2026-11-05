// A small PostgREST: just the parts of its query language the app uses.
//   select with joins   ?select=*,university_costs(*),smu_module:smu_modules(id),mod:university_modules!inner(*)
//   filters             ?col=eq.5   ?col=in.(1,2)   ?embedded.col=eq.5   ?col=is.null
//   ordering and paging ?order=id.asc   ?review_comments.order=created_at.asc   ?limit=10&offset=20
import { relationBetween, TABLES } from './schema.js'
import { canSelect } from './policies.js'

export class PostgrestError extends Error {
  constructor(status, code, message, details = null, hint = null) {
    super(message)
    this.status = status
    this.body = { code, message, details, hint }
  }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

/* ---------- select ---------- */

function splitTop(text) {
  const parts = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else current += char
  }
  if (current.trim()) parts.push(current)
  return parts.map((p) => p.trim()).filter(Boolean)
}

export function parseSelect(text = '*') {
  return splitTop(text.replace(/\s+/g, ' ')).map((token) => {
    const open = token.indexOf('(')
    if (open === -1) {
      if (token === '*') return { type: 'star' }
      const [alias, name] = token.includes(':') ? token.split(':') : [null, token]
      return { type: 'column', name: name.split('::')[0], alias }
    }
    const head = token.slice(0, open).trim()
    const inside = token.slice(open + 1, token.lastIndexOf(')'))
    const [aliasPart, rest] = head.includes(':') ? head.split(':') : [null, head]
    const [table, ...hints] = rest.split('!')
    return { type: 'embed', table, alias: aliasPart ?? table, inner: hints.includes('inner'), children: parseSelect(inside || '*') }
  })
}

/* ---------- filters ---------- */

function coerce(left, right) {
  const numeric = (v) => v !== null && v !== '' && v !== undefined && typeof v !== 'boolean' && !Number.isNaN(Number(v))
  return numeric(left) && numeric(right) ? [Number(left), Number(right)] : [String(left), String(right)]
}

function matches(value, operator, argument) {
  const negate = operator.startsWith('not.')
  const op = negate ? operator.slice(4) : operator
  let result
  if (op === 'is') result = argument === 'null' ? value === null || value === undefined : String(value) === argument
  else if (op === 'in') {
    const list = argument.replace(/^\(|\)$/g, '').split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    result = list.includes(String(value))
  } else if (value === null || value === undefined) result = false
  else if (op === 'like' || op === 'ilike') {
    const pattern = new RegExp(`^${argument.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*')}$`, op === 'ilike' ? 'i' : '')
    result = pattern.test(String(value))
  } else {
    const [a, b] = coerce(value, argument)
    result = { eq: a === b, neq: a !== b, gt: a > b, gte: a >= b, lt: a < b, lte: a <= b }[op]
    if (result === undefined) throw new PostgrestError(400, 'PGRST100', `Unsupported operator "${op}"`)
  }
  return negate ? !result : result
}

function parseFilters(searchParams) {
  const filters = []
  for (const [key, raw] of searchParams.entries()) {
    if (RESERVED.has(key) || key.endsWith('.order') || key.endsWith('.limit') || key.endsWith('.offset')) continue
    const dot = raw.indexOf('.')
    if (dot === -1) throw new PostgrestError(400, 'PGRST100', `"failed to parse filter (${raw})"`)
    filters.push({ path: key.split('.'), operator: raw.slice(0, dot), argument: raw.slice(dot + 1) })
  }
  return filters
}

/* ---------- ordering and paging ---------- */

function parseOrder(text) {
  if (!text) return []
  return text.split(',').map((part) => {
    const [column, ...flags] = part.split('.')
    return { column, descending: flags.includes('desc') }
  })
}

function compare(a, b) {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  const [x, y] = coerce(a, b)
  return x < y ? -1 : 1
}

function sortRows(rows, order) {
  if (!order.length) return rows
  return [...rows].sort((a, b) => {
    for (const { column, descending } of order) {
      const result = compare(a[column], b[column])
      if (result) return descending ? -result : result
    }
    return 0
  })
}

/* ---------- running a query ---------- */

export function knownColumns(db, table) {
  const columns = new Set(db.columns(table))
  return columns
}

function project(db, table, row, nodes, ctx, embedFilters, params, prefix) {
  const out = {}
  const columns = knownColumns(db, table)
  for (const node of nodes) {
    if (node.type === 'star') Object.assign(out, row)
    else if (node.type === 'column') {
      if (!columns.has(node.name)) throw new PostgrestError(400, '42703', `column ${table}.${node.name} does not exist`)
      out[node.alias ?? node.name] = row[node.name] ?? null
    }
  }
  for (const node of nodes.filter((n) => n.type === 'embed')) {
    const embedded = embed(db, table, row, node, ctx, embedFilters, params, prefix)
    if (embedded === DROP) return DROP
    out[node.alias] = embedded
  }
  return out
}

const DROP = Symbol('drop')

function embed(db, parentTable, parentRow, node, ctx, filters, params, prefix) {
  const relation = relationBetween(parentTable, node.table)
  if (!relation) {
    throw new PostgrestError(400, 'PGRST200', `Could not find a relationship between '${parentTable}' and '${node.table}' in the schema cache`)
  }
  const names = [node.alias, node.table].map((n) => `${prefix}${n}`)
  const own = filters
    .filter((f) => f.path.length > 1 && names.some((name) => f.path.join('.').startsWith(`${name}.`)))
    .map((f) => {
      const used = names.find((name) => f.path.join('.').startsWith(`${name}.`))
      return { ...f, path: f.path.join('.').slice(used.length + 1).split('.') }
    })

  let candidates = db.rows(node.table).filter((other) => other[relation.otherColumn] === parentRow[relation.parentColumn])
  candidates = candidates.filter((other) => canSelect(db, node.table, other, ctx))
  const ownDirect = own.filter((f) => f.path.length === 1)
  candidates = candidates.filter((other) => ownDirect.every((f) => matches(other[f.path[0]], f.operator, f.argument)))

  const embedPrefix = `${prefix}${node.alias}.`
  candidates = sortRows(candidates, parseOrder(params.get(`${embedPrefix}order`) ?? params.get(`${prefix}${node.table}.order`)))
  const shaped = []
  for (const other of candidates) {
    const row = project(db, node.table, other, node.children, ctx, own.filter((f) => f.path.length > 1), params, '')
    if (row !== DROP) shaped.push(row)
  }
  if (node.inner && shaped.length === 0) return DROP
  return relation.kind === 'one' ? shaped[0] ?? null : shaped
}

/** Runs ?select=... with every filter, ordering and paging; returns the shaped rows. */
export function runSelect(db, table, params, ctx, { single = false } = {}) {
  if (!TABLES[table]) throw new PostgrestError(404, 'PGRST205', `Could not find the table 'public.${table}' in the schema cache`)
  const nodes = parseSelect(params.get('select') ?? '*')
  const filters = parseFilters(params)
  const direct = filters.filter((f) => f.path.length === 1)
  const nested = filters.filter((f) => f.path.length > 1)

  let rows = db.rows(table).filter((row) => canSelect(db, table, row, ctx))
  rows = rows.filter((row) => direct.every((f) => matches(row[f.path[0]], f.operator, f.argument)))
  rows = sortRows(rows, parseOrder(params.get('order')))
  const offset = Number(params.get('offset') ?? 0)
  const limit = params.get('limit') !== null ? Number(params.get('limit')) : null

  const shaped = []
  for (const row of rows) {
    const out = project(db, table, row, nodes, ctx, nested, params, '')
    if (out !== DROP) shaped.push(out)
  }
  const page = shaped.slice(offset, limit === null ? undefined : offset + limit)
  if (single) {
    if (page.length !== 1) {
      throw new PostgrestError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${page.length} rows`)
    }
    return page[0]
  }
  return page
}

/** Shapes rows that were just written (insert/update/delete) with the request's ?select=. */
export function shapeRows(db, table, rows, params, ctx) {
  const nodes = parseSelect(params.get('select') ?? '*')
  return rows.map((row) => {
    const out = project(db, table, row, nodes, ctx, [], params, '')
    return out === DROP ? row : out
  })
}
