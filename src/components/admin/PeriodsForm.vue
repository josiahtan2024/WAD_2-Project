<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ periods: { type: Array, default: () => [] } })
const emit = defineEmits(['submit'])

let counter = 0
const blank = () => ({ key: ++counter, id: null, period_name: '', term: '', academic_year: '', start_date: '', end_date: '', min_temperature: '', max_temperature: '', description: '' })
const toRow = (p) => ({ ...blank(), ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? ''])), key: ++counter })

const rows = ref(props.periods.map(toRow))
const errors = ref({})

const removedExisting = computed(() => props.periods.some((p) => !rows.value.some((r) => r.id === p.id)))

function addRow() {
  rows.value.push(blank())
}

function removeRow(row) {
  rows.value = rows.value.filter((r) => r.key !== row.key)
}

function plusOneYear(date) {
  const [year, month, day] = date.split('-').map(Number)
  const moved = new Date(Date.UTC(year + 1, month - 1, day))
  if (moved.getUTCMonth() !== month - 1) moved.setUTCDate(0) // 29 Feb into a year without one
  return moved.toISOString().slice(0, 10)
}

// every period again, one year later, as new rows to adjust
function copyToNextYear() {
  const next = rows.value.map((row) => {
    const copy = { ...row, key: ++counter, id: null }
    const year = row.academic_year
    if (/^\d{4}$/.test(year)) {
      copy.academic_year = String(Number(year) + 1)
      copy.period_name = row.period_name.replace(year, copy.academic_year)
    }
    if (row.start_date) copy.start_date = plusOneYear(row.start_date)
    if (row.end_date) copy.end_date = plusOneYear(row.end_date)
    return copy
  })
  rows.value.push(...next)
}

function submit() {
  const found = {}
  const clean = rows.value.map((row) => {
    const out = { id: row.id }
    for (const field of ['period_name', 'term', 'academic_year', 'description']) out[field] = String(row[field]).trim() || null
    out.start_date = row.start_date || null
    out.end_date = row.end_date || null
    for (const field of ['min_temperature', 'max_temperature']) {
      const text = String(row[field]).trim()
      out[field] = text === '' ? null : Number(text)
    }

    if (!out.period_name) found[row.key] = 'Give the period a name.'
    else if (out.start_date && out.end_date && out.end_date < out.start_date) found[row.key] = 'The end date is before the start date.'
    else if ([out.min_temperature, out.max_temperature].some((t) => t !== null && !Number.isFinite(t))) found[row.key] = 'Temperatures must be numbers.'
    else if (out.min_temperature !== null && out.max_temperature !== null && out.max_temperature < out.min_temperature) found[row.key] = 'The highest temperature is below the lowest.'
    return out
  })
  errors.value = found
  if (Object.keys(found).length === 0) emit('submit', clean)
}
</script>

<template>
  <form id="admin-form" novalidate @submit.prevent="submit">
    <p v-if="!rows.length" class="text-secondary" data-testid="admin-no-periods">No exchange periods yet.</p>

    <fieldset v-for="(row, index) in rows" :key="row.key" class="border rounded p-3 mb-3" data-testid="admin-period-row">
      <legend class="float-none w-auto px-2 fs-6 mb-0">Period {{ index + 1 }}</legend>
      <div class="row g-2">
        <div class="col-12">
          <label class="form-label small" :for="`period-name-${row.key}`">Name</label>
          <input :id="`period-name-${row.key}`" v-model="row.period_name" class="form-control" placeholder="Fall 2027" data-testid="admin-period-name" />
        </div>
        <div class="col-6">
          <label class="form-label small" :for="`period-term-${row.key}`">Term</label>
          <input :id="`period-term-${row.key}`" v-model="row.term" class="form-control" data-testid="admin-period-term" />
        </div>
        <div class="col-6">
          <label class="form-label small" :for="`period-year-${row.key}`">Academic year</label>
          <input :id="`period-year-${row.key}`" v-model="row.academic_year" class="form-control" data-testid="admin-period-year" />
        </div>
        <div class="col-6">
          <label class="form-label small" :for="`period-start-${row.key}`">Starts</label>
          <input :id="`period-start-${row.key}`" v-model="row.start_date" type="date" class="form-control" data-testid="admin-period-start" />
        </div>
        <div class="col-6">
          <label class="form-label small" :for="`period-end-${row.key}`">Ends</label>
          <input :id="`period-end-${row.key}`" v-model="row.end_date" type="date" class="form-control" data-testid="admin-period-end" />
        </div>
        <div class="col-6">
          <label class="form-label small" :for="`period-min-${row.key}`">Lowest °C</label>
          <input :id="`period-min-${row.key}`" v-model="row.min_temperature" class="form-control" inputmode="numeric" data-testid="admin-period-min" />
        </div>
        <div class="col-6">
          <label class="form-label small" :for="`period-max-${row.key}`">Highest °C</label>
          <input :id="`period-max-${row.key}`" v-model="row.max_temperature" class="form-control" inputmode="numeric" data-testid="admin-period-max" />
        </div>
        <div class="col-12">
          <label class="form-label small" :for="`period-desc-${row.key}`">Overview</label>
          <input :id="`period-desc-${row.key}`" v-model="row.description" class="form-control" data-testid="admin-period-description" />
        </div>
      </div>
      <div v-if="errors[row.key]" class="text-danger small mt-2" data-testid="admin-field-error">{{ errors[row.key] }}</div>
      <button type="button" class="btn btn-link btn-sm text-danger px-0 mt-2" data-testid="admin-period-remove" @click="removeRow(row)">Remove this period</button>
    </fieldset>

    <p v-if="removedExisting" class="text-danger small" data-testid="admin-period-warning">
      Removing a period also removes the timetables students have planned for it.
    </p>

    <div class="d-flex flex-wrap gap-2">
      <button type="button" class="btn btn-outline-primary btn-sm" data-testid="admin-period-add" @click="addRow">Add a period</button>
      <button v-if="rows.length" type="button" class="btn btn-outline-secondary btn-sm" data-testid="admin-period-copy" @click="copyToNextYear">Copy all to next year</button>
    </div>
  </form>
</template>
