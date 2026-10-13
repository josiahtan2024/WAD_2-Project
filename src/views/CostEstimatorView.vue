
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'

const universities = ref([])
const costs = ref([])
const selectedUniversityId = ref('')
const durationMonths = ref(6)

const accommodation = ref(0)
const food = ref(0)
const transport = ref(0)
const personal = ref(0)
const other = ref(0)

const sgdRate = ref(null)
const rateAvailable = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')

const selectedUniversity = computed(() =>
  universities.value.find(
    university => String(university.id) === String(selectedUniversityId.value)
  )
)

const currency = computed(
  () => selectedUniversity.value?.currency_code || 'SGD'
)

const totalBudget = computed(() =>
  Number(accommodation.value || 0) +
  Number(food.value || 0) +
  Number(transport.value || 0) +
  Number(personal.value || 0) +
  Number(other.value || 0)
)

const tripBudget = computed(() =>
  totalBudget.value * Number(durationMonths.value)
)

const totalInSGD = computed(() => {
  if (currency.value === 'SGD') return tripBudget.value
  if (!rateAvailable.value || !sgdRate.value) return null

  // Rate is expressed as local currency per SGD.
  return tripBudget.value / sgdRate.value
})

function formatMoney(amount, currencyCode) {
  if (amount === null || amount === undefined) return 'Unavailable'

  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount)
}

async function loadUniversities() {
  loading.value = true
  error.value = ''

  try {
    const { data, error: queryError } = await supabase
      .from('universities')
      .select('id, name, country, city, region, currency_code')
      .order('name')

    if (queryError) throw queryError

    universities.value = data || []

    if (universities.value.length > 0) {
      selectedUniversityId.value = String(universities.value[0].id)
    }
  } catch (e) {
    error.value = `Unable to load universities: ${e.message}`
  } finally {
    loading.value = false
  }
}

async function loadCosts() {
  costs.value = []

  if (!selectedUniversityId.value) return

  const { data, error: queryError } = await supabase
    .from('university_costs')
    .select('*')
    .eq('university_id', selectedUniversityId.value)
    .order('category')

  if (queryError) {
    error.value = `Unable to load cost estimates: ${queryError.message}`
    return
  }

  costs.value = data || []
}

async function loadExchangeRate() {
  rateAvailable.value = false
  sgdRate.value = null

  if (!currency.value || currency.value === 'SGD') {
    rateAvailable.value = true
    sgdRate.value = 1
    return
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=SGD&symbols=${encodeURIComponent(currency.value)}`
    )

    if (!response.ok) {
      throw new Error('Exchange-rate service is unavailable.')
    }

    const data = await response.json()
    const rate = data.rates?.[currency.value]

    if (!rate || !Number.isFinite(rate)) {
      throw new Error('Exchange rate not found.')
    }

    sgdRate.value = rate
    rateAvailable.value = true
  } catch (e) {
    error.value = `Currency conversion unavailable: ${e.message}`
  }
}

async function loadSavedBudget() {
  message.value = ''

  if (!selectedUniversityId.value) return

  const { data: userData, error: userError } =
    await supabase.auth.getUser()

  if (userError || !userData.user) return

  const { data, error: queryError } = await supabase
    .from('user_budgets')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('university_id', selectedUniversityId.value)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (queryError) {
    error.value = `Unable to load saved budget: ${queryError.message}`
    return
  }

  if (data) {
    durationMonths.value = data.duration_months
    accommodation.value = Number(data.accommodation_budget)
    food.value = Number(data.food_budget)
    transport.value = Number(data.transport_budget)
    personal.value = Number(data.personal_budget)
    other.value = Number(data.other_budget)
  } else {
    accommodation.value = 0
    food.value = 0
    transport.value = 0
    personal.value = 0
    other.value = 0
  }
}

async function saveBudget() {
  error.value = ''
  message.value = ''

  if (!selectedUniversityId.value) {
    error.value = 'Please select a university.'
    return
  }

  saving.value = true

  try {
    const { data: userData, error: userError } =
      await supabase.auth.getUser()

    if (userError) throw userError

    if (!userData.user) {
      error.value = 'Please log in to save your budget.'
      return
    }

    const payload = {
      user_id: userData.user.id,
      university_id: Number(selectedUniversityId.value),
      duration_months: Number(durationMonths.value),
      currency_code: currency.value,
      accommodation_budget: Number(accommodation.value || 0),
      food_budget: Number(food.value || 0),
      transport_budget: Number(transport.value || 0),
      personal_budget: Number(personal.value || 0),
      other_budget: Number(other.value || 0),
      total_budget: totalBudget.value,
      updated_at: new Date().toISOString(),
    }

    const { data: existing, error: lookupError } = await supabase
      .from('user_budgets')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('university_id', Number(selectedUniversityId.value))
      .limit(1)
      .maybeSingle()

    if (lookupError) throw lookupError

    if (existing) {
      const { error: updateError } = await supabase
        .from('user_budgets')
        .update(payload)
        .eq('id', existing.id)

      if (updateError) throw updateError
    } else {
      const { error: insertError } = await supabase
        .from('user_budgets')
        .insert(payload)

      if (insertError) throw insertError
    }

    message.value = 'Your budget has been saved successfully.'
  } catch (e) {
    error.value = `Unable to save budget: ${e.message}`
  } finally {
    saving.value = false
  }
}

watch(selectedUniversityId, async () => {
  error.value = ''
  await Promise.all([
    loadCosts(),
    loadExchangeRate(),
    loadSavedBudget(),
  ])
})

onMounted(loadUniversities)
</script>

<template>
  <div class="container py-4">
    <div class="mb-4">
      <h1 class="h2">Cost Estimation &amp; Budgeting</h1>
      <p class="text-muted">
        Estimate your exchange expenses, convert your budget to SGD,
        and save your personal spending plan.
      </p>
    </div>

    <div
      v-if="error"
      class="alert alert-danger"
      role="alert"
    >
      {{ error }}
    </div>

    <div
      v-if="message"
      class="alert alert-success"
      role="status"
    >
      {{ message }}
    </div>

    <div v-if="loading" class="text-muted">
      Loading universities...
    </div>

    <div v-else class="row g-4">
      <div class="col-12 col-lg-7">
        <div class="card shadow-sm">
          <div class="card-body">
            <h2 class="h5 mb-3">Your exchange budget</h2>

            <div class="mb-3">
              <label for="university" class="form-label">
                Select university
              </label>
              <select
                id="university"
                v-model="selectedUniversityId"
                class="form-select"
              >
                <option
                  v-for="university in universities"
                  :key="university.id"
                  :value="String(university.id)"
                >
                  {{ university.name }} — {{ university.country }}
                </option>
              </select>
            </div>

            <div class="mb-3">
              <label for="duration" class="form-label">
                Exchange duration (months)
              </label>
              <input
                id="duration"
                v-model.number="durationMonths"
                type="number"
                min="1"
                max="12"
                class="form-control"
              />
            </div>

            <hr />

            <h3 class="h6">Estimated monthly expenses</h3>
            <p class="small text-muted">
              Enter your estimated spending in {{ currency }} per month.
            </p>

            <div class="mb-3">
              <label for="accommodation" class="form-label">
                Accommodation
              </label>
              <input
                id="accommodation"
                v-model.number="accommodation"
                type="number"
                min="0"
                step="0.01"
                class="form-control"
              />
            </div>

            <div class="mb-3">
              <label for="food" class="form-label">Food</label>
              <input
                id="food"
                v-model.number="food"
                type="number"
                min="0"
                step="0.01"
                class="form-control"
              />
            </div>

            <div class="mb-3">
              <label for="transport" class="form-label">
                Transport
              </label>
              <input
                id="transport"
                v-model.number="transport"
                type="number"
                min="0"
                step="0.01"
                class="form-control"
              />
            </div>

            <div class="mb-3">
              <label for="personal" class="form-label">
                Personal expenses
              </label>
              <input
                id="personal"
                v-model.number="personal"
                type="number"
                min="0"
                step="0.01"
                class="form-control"
              />
            </div>

            <div class="mb-3">
              <label for="other" class="form-label">
                Other expenses
              </label>
              <input
                id="other"
                v-model.number="other"
                type="number"
                min="0"
                step="0.01"
                class="form-control"
              />
            </div>

            <button
              class="btn btn-primary w-100"
              :disabled="saving || !selectedUniversityId"
              @click="saveBudget"
            >
              {{ saving ? 'Saving...' : 'Save My Budget' }}
            </button>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-5">
        <div class="card shadow-sm mb-4">
          <div class="card-body">
            <h2 class="h5">Your budget summary</h2>

            <p class="text-muted mb-1">Monthly budget</p>
            <h3 class="h4">
              {{ formatMoney(totalBudget, currency) }}
            </h3>

            <p class="text-muted mb-1 mt-3">
              Total for {{ durationMonths }} months
            </p>
            <h3 class="h4">
              {{ formatMoney(tripBudget, currency) }}
            </h3>

            <p class="text-muted mb-1 mt-3">Estimated total in SGD</p>
            <h3 class="h4">
              {{ totalInSGD === null
                ? 'Unavailable'
                : formatMoney(totalInSGD, 'SGD') }}
            </h3>

            <p
              v-if="currency !== 'SGD' && rateAvailable"
              class="small text-muted mb-0"
            >
              1 SGD = {{ sgdRate }} {{ currency }}
            </p>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-body">
            <h2 class="h5">Published cost estimates</h2>

            <p
              v-if="costs.length === 0"
              class="text-muted"
            >
              No published cost records are available for this university yet.
            </p>

            <div
              v-for="cost in costs"
              :key="cost.id"
              class="border-bottom py-3"
            >
              <div class="fw-semibold">
                {{ cost.category.replaceAll('_', ' ') }}
              </div>

              <div>
                {{ formatMoney(Number(cost.amount_min), cost.currency_code) }}
                –
                {{ formatMoney(Number(cost.amount_max), cost.currency_code) }}
              </div>

              <div class="small text-muted">
                Period: {{ cost.period.replaceAll('_', ' ') }}
              </div>

              <div v-if="cost.notes" class="small text-muted mt-1">
                {{ cost.notes }}
              </div>

              <a
                :href="cost.source_url"
                target="_blank"
                rel="noopener noreferrer"
                class="small"
              >
                View source: {{ cost.source_name }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
