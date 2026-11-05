<script setup>
import { reactive, ref } from 'vue'
import CoordinatePicker from '@/components/admin/CoordinatePicker.vue'

const props = defineProps({
  university: { type: Object, default: () => ({}) },
  withName: { type: Boolean, default: false },
})
const emit = defineEmits(['submit'])

function parseTimezoneToNumber(tz) {
  if (tz === null || tz === undefined || tz === '') return ''
  const match = String(tz).match(/([+-]?\d+)/)
  return match ? parseInt(match[1], 10) : ''
}

const u = props.university
const form = reactive({
  name: u.name ?? '',
  country: u.country ?? '',
  state: u.state ?? '',
  city: u.city ?? '',
  region: u.region ?? '',
  timezone: parseTimezoneToNumber(u.timezone),
  lat: u.lat ?? '',
  long: u.long ?? '',
})
const errors = ref({})

const ALLOWED_REGIONS = [
  'Africa',
  'Americas',
  'Asia',
  'Europe',
  'Middle-East',
  'Oceania',
]

const timezoneOffsets = Array.from({ length: 27 }, (_, i) => i - 12)

function coordinate(value, limit, label) {
  const text = String(value).trim()
  if (text === '') return { value: null }
  const number = Number(text)
  if (!Number.isFinite(number) || Math.abs(number) > limit) return { error: `${label} must be between -${limit} and ${limit}.` }
  return { value: number }
}

function submit() {
  const found = {}
  if (props.withName && !form.name.trim()) found.name = 'Enter the university name.'
  if (!form.country.trim()) found.country = 'Enter the country.'
  if (!form.region) {
    found.region = 'Select a region.'
  } else if (!ALLOWED_REGIONS.includes(form.region)) {
    found.region = 'Invalid region selected.'
  }

  let tzValue = null
  if (String(form.timezone).trim() !== '') {
    const parsedTz = Number(form.timezone)
    if (!Number.isInteger(parsedTz) || parsedTz < -12 || parsedTz > 14) {
      found.timezone = 'Offset must be between -12 and +14.'
    } else {
      tzValue = parsedTz >= 0 ? `UTC+${parsedTz}` : `UTC${parsedTz}`
    }
  }

  const lat = coordinate(form.lat, 90, 'Latitude')
  const long = coordinate(form.long, 180, 'Longitude')
  if (lat.error) found.lat = lat.error
  if (long.error) found.long = long.error
  if ((lat.value === null) !== (long.value === null)) found.lat = found.lat ?? 'Enter both coordinates or leave both empty.'

  errors.value = found
  if (Object.keys(found).length) return

  const fields = {
    country: form.country.trim(),
    state: form.state.trim() || null,
    city: form.city.trim() || null,
    region: form.region,
    timezone: tzValue,
    lat: lat.value,
    long: long.value,
  }
  if (props.withName) fields.name = form.name.trim()
  emit('submit', fields)
}

function pick({ lat, lng }) {
  form.lat = lat
  form.long = lng
}
</script>

<template>
  <form id="admin-form" novalidate @submit.prevent="submit">
    <div v-if="withName" class="mb-3">
      <label class="form-label fw-semibold text-navy small mb-1" for="loc-name">University Name</label>
      <input id="loc-name" v-model="form.name" class="form-control shadow-none" :class="{ 'is-invalid': errors.name }" data-testid="admin-field-name" />
      <div v-if="errors.name" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.name }}</div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-sm-6">
        <label class="form-label fw-semibold text-navy small mb-1" for="loc-country">Country</label>
        <input id="loc-country" v-model="form.country" class="form-control shadow-none" :class="{ 'is-invalid': errors.country }" data-testid="admin-field-country" />
        <div v-if="errors.country" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.country }}</div>
      </div>

      <div class="col-12 col-sm-6">
        <label class="form-label fw-semibold text-navy small mb-1" for="loc-region">Region</label>
        <select id="loc-region" v-model="form.region" class="form-select shadow-none" :class="{ 'is-invalid': errors.region }" data-testid="admin-field-region">
          <option value="" disabled>Select Region</option>
          <option v-for="r in ALLOWED_REGIONS" :key="r" :value="r">{{ r }}</option>
        </select>
        <div v-if="errors.region" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.region }}</div>
      </div>

      <div class="col-12 col-sm-6">
        <label class="form-label fw-semibold text-navy small mb-1" for="loc-state">State / Province</label>
        <input id="loc-state" v-model="form.state" class="form-control shadow-none" data-testid="admin-field-state" />
      </div>

      <div class="col-12 col-sm-6">
        <label class="form-label fw-semibold text-navy small mb-1" for="loc-city">City</label>
        <input id="loc-city" v-model="form.city" class="form-control shadow-none" data-testid="admin-field-city" />
      </div>

      <div class="col-12">
        <label class="form-label fw-semibold text-navy small mb-1" for="loc-timezone">Timezone Offset</label>
        <select id="loc-timezone" v-model="form.timezone" class="form-select shadow-none" :class="{ 'is-invalid': errors.timezone }" data-testid="admin-field-timezone">
          <option value="" disabled>Select UTC Offset</option>
          <option v-for="offset in timezoneOffsets" :key="offset" :value="offset">
            {{ offset >= 0 ? `UTC+${offset}` : `UTC${offset}` }}
          </option>
        </select>
        <div v-if="errors.timezone" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.timezone }}</div>
      </div>
    </div>

    <!-- Map picker only displayed when editing existing university -->
    <template v-if="!withName">
      <div class="mt-3 mb-1">
        <label class="form-label fw-semibold text-navy small mb-1">Map Position</label>
        <CoordinatePicker :lat="form.lat" :lng="form.long" @pick="pick" />
      </div>
    </template>

    <div class="row g-2 mt-2">
      <div class="col-6">
        <label class="form-label small fw-semibold text-navy mb-1" for="loc-lat">Latitude</label>
        <input id="loc-lat" v-model="form.lat" type="number" step="any" class="form-control shadow-none" inputmode="decimal" :class="{ 'is-invalid': errors.lat }" data-testid="admin-field-lat" />
      </div>
      <div class="col-6">
        <label class="form-label small fw-semibold text-navy mb-1" for="loc-long">Longitude</label>
        <input id="loc-long" v-model="form.long" type="number" step="any" class="form-control shadow-none" inputmode="decimal" :class="{ 'is-invalid': errors.long }" data-testid="admin-field-long" />
      </div>
      <div v-if="errors.lat || errors.long" class="col-12 invalid-feedback d-block mt-1" data-testid="admin-field-error">
        {{ errors.lat || errors.long }}
      </div>
    </div>
  </form>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}
</style>