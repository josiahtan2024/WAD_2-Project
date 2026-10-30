<script setup>
import { computed, reactive, ref } from 'vue'
import { useUniversitiesStore } from '@/stores/universities'
import CoordinatePicker from '@/components/admin/CoordinatePicker.vue'

const props = defineProps({
  university: { type: Object, default: () => ({}) },
  withName: { type: Boolean, default: false }, // the "add university" form also asks for the name
})
const emit = defineEmits(['submit'])

const uni = useUniversitiesStore()
const u = props.university
const form = reactive({
  name: u.name ?? '',
  country: u.country ?? '',
  state: u.state ?? '',
  city: u.city ?? '',
  region: u.region ?? '',
  timezone: u.timezone ?? '',
  lat: u.lat ?? '',
  long: u.long ?? '',
})
const errors = ref({})

const regions = computed(() => [...new Set(uni.items.map((x) => x.region).filter(Boolean))].sort())
const countries = computed(() => [...new Set(uni.items.map((x) => x.country).filter(Boolean))].sort())
const offsets = Array.from({ length: 27 }, (_, i) => {
  const hours = i - 12
  return `UTC${hours < 0 ? '-' : '+'}${Math.abs(hours)}`
})

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
  if (!form.region.trim()) found.region = 'Enter the region.'
  const lat = coordinate(form.lat, 90, 'Latitude')
  const long = coordinate(form.long, 180, 'Longitude')
  if (lat.error) found.lat = lat.error
  if (long.error) found.long = long.error
  if ((lat.value === null) !== (long.value === null)) found.lat = found.lat ?? 'Give both latitude and longitude, or neither.'
  errors.value = found
  if (Object.keys(found).length) return

  // reuse an existing region spelled differently, so the region filter does not get a near-duplicate
  const typed = form.region.trim()
  const region = regions.value.find((r) => r.toLowerCase() === typed.toLowerCase()) ?? typed

  const fields = {
    country: form.country.trim(),
    state: form.state.trim() || null,
    city: form.city.trim() || null,
    region,
    timezone: form.timezone.trim() || null,
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
      <label class="form-label" for="loc-name">University name</label>
      <input id="loc-name" v-model="form.name" class="form-control" :class="{ 'is-invalid': errors.name }" data-testid="admin-field-name" />
      <div v-if="errors.name" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.name }}</div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-sm-6">
        <label class="form-label" for="loc-country">Country</label>
        <input id="loc-country" v-model="form.country" class="form-control" list="loc-countries" :class="{ 'is-invalid': errors.country }" data-testid="admin-field-country" />
        <datalist id="loc-countries"><option v-for="c in countries" :key="c" :value="c" /></datalist>
        <div v-if="errors.country" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.country }}</div>
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" for="loc-region">Region</label>
        <input id="loc-region" v-model="form.region" class="form-control" list="loc-regions" :class="{ 'is-invalid': errors.region }" data-testid="admin-field-region" />
        <datalist id="loc-regions"><option v-for="r in regions" :key="r" :value="r" /></datalist>
        <div v-if="errors.region" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.region }}</div>
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" for="loc-state">State / province</label>
        <input id="loc-state" v-model="form.state" class="form-control" data-testid="admin-field-state" />
      </div>
      <div class="col-12 col-sm-6">
        <label class="form-label" for="loc-city">City</label>
        <input id="loc-city" v-model="form.city" class="form-control" data-testid="admin-field-city" />
      </div>
      <div class="col-12">
        <label class="form-label" for="loc-timezone">Timezone</label>
        <input id="loc-timezone" v-model="form.timezone" class="form-control" list="loc-offsets" placeholder="UTC+9" data-testid="admin-field-timezone" />
        <datalist id="loc-offsets"><option v-for="o in offsets" :key="o" :value="o" /></datalist>
      </div>
    </div>

    <p class="form-label mt-3 mb-1">Location on the map</p>
    <CoordinatePicker :lat="form.lat" :lng="form.long" @pick="pick" />
    <div class="row g-3 mt-0">
      <div class="col-6">
        <label class="form-label small" for="loc-lat">Latitude</label>
        <input id="loc-lat" v-model="form.lat" class="form-control" inputmode="decimal" :class="{ 'is-invalid': errors.lat }" data-testid="admin-field-lat" />
      </div>
      <div class="col-6">
        <label class="form-label small" for="loc-long">Longitude</label>
        <input id="loc-long" v-model="form.long" class="form-control" inputmode="decimal" :class="{ 'is-invalid': errors.long }" data-testid="admin-field-long" />
      </div>
      <div v-if="errors.lat || errors.long" class="col-12 invalid-feedback d-block mt-1" data-testid="admin-field-error">{{ errors.lat || errors.long }}</div>
    </div>
  </form>
</template>
