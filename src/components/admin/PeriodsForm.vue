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

function submit() {
  const found = {}
  const clean = rows.value.map((row) => {
    const out = { id: row.id }
    out.period_name = String(row.period_name).trim() || null
    out.academic_year = String(row.academic_year).trim() || null
    out.description = String(row.description).trim() || null
    out.start_date = row.start_date || null
    out.end_date = row.end_date || null

    const termText = String(row.term).trim()
    if (termText === '') {
      out.term = null
    } else {
      const termNum = Number(termText)
      if (!Number.isInteger(termNum) || termNum < 1) {
        found[row.key] = 'Term must be a positive integer.'
      }
      out.term = termNum
    }

    for (const field of ['min_temperature', 'max_temperature']) {
      const text = String(row[field]).trim()
      if (text === '') {
        out[field] = null
      } else {
        const num = Number(text)
        if (!Number.isFinite(num)) found[row.key] = 'Temperatures must be valid numbers.'
        out[field] = num
      }
    }

    if (!out.period_name) found[row.key] = 'Give the period a name.'
    else if (out.start_date && out.end_date && out.end_date < out.start_date) found[row.key] = 'End date cannot be before start date.'
    else if (out.min_temperature !== null && out.max_temperature !== null && out.max_temperature < out.min_temperature) found[row.key] = 'Highest temperature must be greater than lowest.'
    
    return out
  })
  errors.value = found
  if (Object.keys(found).length === 0) emit('submit', clean)
}
</script>

<template>
  <form id="admin-form" novalidate @submit.prevent="submit">
    <p v-if="!rows.length" class="text-muted small py-3 text-center border border-dashed rounded-3" data-testid="admin-no-periods">
      No exchange periods added yet.
    </p>

    <fieldset v-for="(row, index) in rows" :key="row.key" class="border rounded-4 p-3 mb-3 bg-white shadow-sm" data-testid="admin-period-row">
      <legend class="float-none w-auto px-2 fs-6 fw-bold text-navy mb-0">Exchange Period {{ index + 1 }}</legend>
      
      <div class="row g-2.5">
        <div class="col-12">
          <label class="form-label small fw-semibold text-navy mb-1" :for="`period-name-${row.key}`">Name</label>
          <input :id="`period-name-${row.key}`" v-model="row.period_name" class="form-control shadow-none" placeholder="e.g. Fall 2027" data-testid="admin-period-name" />
        </div>

        <div class="col-6">
          <label class="form-label small fw-semibold text-navy mb-1" :for="`period-term-${row.key}`">Term</label>
          <input :id="`period-term-${row.key}`" v-model="row.term" type="number" min="1" step="1" class="form-control shadow-none" placeholder="1" data-testid="admin-period-term" />
        </div>

        <div class="col-6">
          <label class="form-label small fw-semibold text-navy mb-1" :for="`period-year-${row.key}`">Academic Year</label>
          <input :id="`period-year-${row.key}`" v-model="row.academic_year" class="form-control shadow-none" placeholder="2026/2027" data-testid="admin-period-year" />
        </div>

        <div class="col-6">
          <label class="form-label small fw-semibold text-navy mb-1" :for="`period-start-${row.key}`">Start Date</label>
          <input :id="`period-start-${row.key}`" v-model="row.start_date" type="date" class="form-control shadow-none" data-testid="admin-period-start" />
        </div>

        <div class="col-6">
          <label class="form-label small fw-semibold text-navy mb-1" :for="`period-end-${row.key}`">End Date</label>
          <input :id="`period-end-${row.key}`" v-model="row.end_date" type="date" class="form-control shadow-none" data-testid="admin-period-end" />
        </div>

        <div class="col-6">
          <label class="form-label small fw-semibold text-navy mb-1" :for="`period-min-${row.key}`">Min Temp (°C)</label>
          <input :id="`period-min-${row.key}`" v-model="row.min_temperature" type="number" step="any" class="form-control shadow-none" inputmode="decimal" placeholder="-5" data-testid="admin-period-min" />
        </div>

        <div class="col-6">
          <label class="form-label small fw-semibold text-navy mb-1" :for="`period-max-${row.key}`">Max Temp (°C)</label>
          <input :id="`period-max-${row.key}`" v-model="row.max_temperature" type="number" step="any" class="form-control shadow-none" inputmode="decimal" placeholder="22" data-testid="admin-period-max" />
        </div>

        <div class="col-12">
          <label class="form-label small fw-semibold text-navy mb-1" :for="`period-desc-${row.key}`">Overview</label>
          <input :id="`period-desc-${row.key}`" v-model="row.description" class="form-control shadow-none" placeholder="e.g. Cold to Warm" data-testid="admin-period-description" />
        </div>
      </div>

      <div v-if="errors[row.key]" class="text-danger small mt-2" data-testid="admin-field-error">
        {{ errors[row.key] }}
      </div>

      <div class="text-end border-top mt-3 pt-2">
        <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3 py-1" data-testid="admin-period-remove" @click="removeRow(row)">
          <i class="bi bi-trash me-1"></i> Remove Period
        </button>
      </div>
    </fieldset>

    <p v-if="removedExisting" class="alert alert-warning small py-2 rounded-3" data-testid="admin-period-warning">
      Warning: Removing existing exchange periods may erase associated student timetables.
    </p>

    <div class="d-flex justify-content-start mt-2">
      <button type="button" class="btn btn-outline-primary btn-sm rounded-pill px-3 py-1.5" data-testid="admin-period-add" @click="addRow">
        <i class="bi bi-plus-lg me-1"></i> Add Period
      </button>
    </div>
  </form>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.border-dashed {
  border-style: dashed !important;
}

.g-2\.5 {
  --bs-gutter-x: 0.625rem;
  --bs-gutter-y: 0.625rem;
}
</style>