<script setup>
import { reactive, ref, watch } from 'vue'
import { estimateCost } from '@/utils/costEstimate'
import { getRate } from '@/lib/frankfurter'

const props = defineProps({ university: { type: Object, required: true } })

const profile = reactive({ housing: 'mid', food: 'mixed', travel: 'medium' })
const range = ref(null) // { min, max } in SGD
const localRange = ref(null) // { min, max } in local currency
const loading = ref(false)
const error = ref('')

const fmt = (n, cur) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n)

async function recalc() {
  loading.value = true
  error.value = ''
  range.value = null
  localRange.value = null
  try {
    range.value = estimateCost(props.university, { ...profile })
    const rate = await getRate('SGD', props.university.currency_code)
    localRange.value = { min: range.value.min * rate, max: range.value.max * rate }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(() => [props.university, profile.housing, profile.food, profile.travel], recalc, { immediate: true })
</script>

<template>
  <div class="card card-body" data-testid="cost-estimator">
    <h2 class="h5">Cost estimate</h2>
    <div class="row g-2 mb-3">
      <div class="col-12 col-sm-4">
        <label class="form-label" for="cost-housing">Housing</label>
        <select id="cost-housing" v-model="profile.housing" class="form-select" data-testid="cost-housing-select">
          <option value="budget">Budget</option>
          <option value="mid">Mid</option>
          <option value="comfortable">Comfortable</option>
        </select>
      </div>
      <div class="col-12 col-sm-4">
        <label class="form-label" for="cost-food">Food</label>
        <select id="cost-food" v-model="profile.food" class="form-select" data-testid="cost-food-select">
          <option value="cook">Cook</option>
          <option value="mixed">Mixed</option>
          <option value="eat-out">Eat out</option>
        </select>
      </div>
      <div class="col-12 col-sm-4">
        <label class="form-label" for="cost-travel">Travel</label>
        <select id="cost-travel" v-model="profile.travel" class="form-select" data-testid="cost-travel-select">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="text-muted" data-testid="cost-loading">Calculating...</div>
    <div v-else-if="error" class="alert alert-warning mb-0" data-testid="cost-error">Could not calculate: {{ error }}</div>
    <div v-else-if="!range" class="text-muted" data-testid="cost-empty">No estimate available.</div>
    <div v-else>
      <p class="fs-4 mb-1" data-testid="cost-sgd">{{ fmt(range.min, 'SGD') }} to {{ fmt(range.max, 'SGD') }}</p>
      <p v-if="localRange" class="text-muted mb-0" data-testid="cost-local">
        About {{ fmt(localRange.min, university.currency_code) }} to {{ fmt(localRange.max, university.currency_code) }}
        (live rate from <a href="https://www.frankfurter.app" target="_blank" rel="noopener">Frankfurter</a>)
      </p>
    </div>
  </div>
</template>
