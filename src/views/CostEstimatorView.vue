<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'

const universities = ref([])
const exchangePeriods = ref([])
const publishedCost = ref(null)

const selectedUniversityId = ref('')
const selectedPeriodId = ref('')
const durationMonths = ref(1)

const housingType = ref('')
const foodOption = ref('')
const transportOption = ref('')

const accommodation = ref(0)
const food = ref(0)
const transport = ref(0)
const personalExpenses = ref(0)
const otherExpenses = ref(0)

const exchangeRate = ref(1)
const rateLoading = ref(false)
const loading = ref(true)
const saving = ref(false)

const errorMessage = ref('')
const successMessage = ref('')

const housingOptions = [
  { value: 'one-room', label: 'One room', multiplier: 1 },
  { value: 'whole-house', label: 'Whole house', multiplier: 2.2 },
  { value: 'share', label: 'Shared accommodation', multiplier: 0.65 },
  { value: 'studio', label: 'Studio apartment', multiplier: 1.4 },
  { value: 'dormitory', label: 'University dormitory', multiplier: 0.7 },
  { value: 'homestay', label: 'Homestay', multiplier: 1.1 },
]

const foodOptions = [
  { value: 'cook', label: 'Cook at home', multiplier: 0.7 },
  { value: 'mixed', label: 'Mix of home cooking and eating out', multiplier: 1 },
  { value: 'eat-out', label: 'Eat out regularly', multiplier: 1.25 },
  { value: 'street-food', label: 'Street food / budget meals', multiplier: 0.8 },
  { value: 'restaurant', label: 'Restaurants', multiplier: 1.6 },
  { value: 'cafe', label: 'Cafes', multiplier: 1.3 },
]

const transportOptions = [
  { value: 'bus', label: 'Bus', multiplier: 0.55 },
  { value: 'train', label: 'Train / metro', multiplier: 0.75 },
  { value: 'walk', label: 'Walking / cycling', multiplier: 0.2 },
  { value: 'cab', label: 'Cab / taxi', multiplier: 1.8 },
  { value: 'rent-car', label: 'Rental car', multiplier: 2.5 },
  { value: 'mixed', label: 'Mixed transport', multiplier: 1 },
]

const selectedUniversity = computed(() =>
  universities.value.find(
    item => String(item.id) === String(selectedUniversityId.value),
  ),
)

const selectedPeriod = computed(() =>
  exchangePeriods.value.find(
    item => String(item.id) === String(selectedPeriodId.value),
  ),
)

const currencyCode = computed(
  () => publishedCost.value?.currency_code || 'SGD',
)

const monthlyBudget = computed(() =>
  [
    accommodation.value,
    food.value,
    transport.value,
    personalExpenses.value,
    otherExpenses.value,
  ].reduce((sum, value) => sum + (Number(value) || 0), 0),
)

const totalExchangeBudget = computed(
  () => monthlyBudget.value * (Number(durationMonths.value) || 0),
)

const publishedMonthlyCost = computed(() => {
  if (!publishedCost.value) return null

  const values = [
    publishedCost.value.accommodation,
    publishedCost.value.food,
    publishedCost.value.transport,
    publishedCost.value.personal_expenses,
    publishedCost.value.other_expenses,
  ].filter(value => value !== null && value !== undefined)

  return values.length
    ? values.reduce((sum, value) => sum + Number(value), 0)
    : null
})

const publishedTotalCost = computed(() =>
  publishedMonthlyCost.value === null
    ? null
    : publishedMonthlyCost.value * (Number(durationMonths.value) || 0),
)

const monthlyBudgetSGD = computed(() => {
  if (currencyCode.value === 'SGD') return monthlyBudget.value
  if (!exchangeRate.value) return null
  return monthlyBudget.value / exchangeRate.value
})

const totalBudgetSGD = computed(() =>
  monthlyBudgetSGD.value === null
    ? null
    : monthlyBudgetSGD.value * (Number(durationMonths.value) || 0),
)

const publishedTotalSGD = computed(() => {
  if (publishedTotalCost.value === null || !exchangeRate.value) return null

  return currencyCode.value === 'SGD'
    ? publishedTotalCost.value
    : publishedTotalCost.value / exchangeRate.value
})

const remainingBudget = computed(() =>
  publishedTotalCost.value === null
    ? null
    : publishedTotalCost.value - totalExchangeBudget.value,
)

const budgetStatus = computed(() => {
  if (remainingBudget.value === null) return ''
  if (remainingBudget.value > 0) return 'below'
  if (remainingBudget.value < 0) return 'above'
  return 'equal'
})

const validBudget = computed(() => {
  const values = [
    accommodation.value,
    food.value,
    transport.value,
    personalExpenses.value,
    otherExpenses.value,
  ]

  return (
    selectedUniversityId.value !== '' &&
    Number.isInteger(Number(durationMonths.value)) &&
    Number(durationMonths.value) >= 1 &&
    Number(durationMonths.value) <= 12 &&
    values.every(
      value =>
        value !== '' &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0,
    )
  )
})

function formatMoney(amount, currency = currencyCode.value) {
  if (
    amount === null ||
    amount === undefined ||
    !Number.isFinite(Number(amount))
  ) {
    return 'Not available'
  }

  try {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount))
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Not specified'

  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString

  return date.toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function calculateDuration(startDate, endDate) {
  if (!startDate || !endDate) return null

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return null
  }

  const monthDifference =
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth()

  const months =
    monthDifference + (end.getDate() > start.getDate() ? 1 : 0)

  return Math.min(12, Math.max(1, months))
}

function applyPeriodDuration(period) {
  if (!period) return

  const months = calculateDuration(period.start_date, period.end_date)

  if (months !== null) durationMonths.value = months
}

function applyOptionPrice(category, options, selectedValue) {
  if (!selectedValue || !publishedCost.value) return

  const base = publishedCost.value[category]

  if (
    base === null ||
    base === undefined ||
    !Number.isFinite(Number(base))
  ) {
    return
  }

  const option = options.find(item => item.value === selectedValue)
  if (!option) return

  const amount = Number(base) * option.multiplier

  if (category === 'accommodation') accommodation.value = amount
  if (category === 'food') food.value = amount
  if (category === 'transport') transport.value = amount
}

function updateAccommodationPrice() {
  applyOptionPrice('accommodation', housingOptions, housingType.value)
}

function updateFoodPrice() {
  applyOptionPrice('food', foodOptions, foodOption.value)
}

function updateTransportPrice() {
  applyOptionPrice('transport', transportOptions, transportOption.value)
}

async function loadUniversities() {
  const { data, error } = await supabase
    .from('universities')
    .select('id, name, country, state, city, region, website_url')
    .order('name')

  if (error) throw error

  universities.value = data || []
  selectedUniversityId.value = ''
}

async function loadPublishedCost() {
  publishedCost.value = null

  if (!selectedUniversityId.value) return

  const { data, error } = await supabase
    .from('university_costs')
    .select(
      'currency_code, accommodation, food, transport, personal_expenses, other_expenses',
    )
    .eq('university_id', selectedUniversityId.value)
    .maybeSingle()

  if (error) throw error

  publishedCost.value = data || null
}

async function loadExchangePeriods() {
  exchangePeriods.value = []
  selectedPeriodId.value = ''

  if (!selectedUniversityId.value) return

  const { data, error } = await supabase
    .from('exchange_periods')
    .select(
      'id, university_id, period_name, term, academic_year, start_date, end_date',
    )
    .eq('university_id', selectedUniversityId.value)
    .order('start_date', { ascending: true })

  if (error) throw error

  exchangePeriods.value = data || []
}

async function loadExchangeRate() {
  exchangeRate.value = 1

  const currency = currencyCode.value

  if (!currency || currency === 'SGD') return

  rateLoading.value = true

  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=SGD&symbols=${encodeURIComponent(currency)}`,
    )

    if (!response.ok) {
      throw new Error('Unable to retrieve the latest exchange rate.')
    }

    const data = await response.json()
    const rate = Number(data.rates?.[currency])

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('The exchange rate is unavailable.')
    }

    exchangeRate.value = rate
  } catch (error) {
    console.error('Currency conversion error:', error)
    errorMessage.value =
      'Could not load the currency conversion rate. Local currency estimates are still available.'
  } finally {
    rateLoading.value = false
  }
}

function clearBudgetInputs() {
  accommodation.value = 0
  food.value = 0
  transport.value = 0
  personalExpenses.value = 0
  otherExpenses.value = 0
}

function resetLifestyleSelections() {
  housingType.value = ''
  foodOption.value = ''
  transportOption.value = ''
}

async function loadSavedBudget() {
  const { data: userResult, error: userError } =
    await supabase.auth.getUser()

  if (userError) throw userError

  const user = userResult?.user

  if (!user || !selectedUniversityId.value) return

 const { data, error } = await supabase
  .from('user_budgets')
  .select(
    'university_id, exchange_period_id, duration_months, accommodation_budget, food_budget, transport_budget, personal_budget, other_budget',
  )
  .eq('user_id', user.id)
  .eq('university_id', selectedUniversityId.value)
  .maybeSingle()

  if (error) throw error

  if (
    !data ||
    String(data.university_id) !== String(selectedUniversityId.value)
  ) {
    return
  }

  selectedPeriodId.value = data.exchange_period_id
    ? String(data.exchange_period_id)
    : ''

  durationMonths.value = Math.min(
    12,
    Math.max(1, Number(data.duration_months) || 1),
  )

  accommodation.value = Number(data.accommodation_budget) || 0
  food.value = Number(data.food_budget) || 0
  transport.value = Number(data.transport_budget) || 0
  personalExpenses.value = Number(data.personal_budget) || 0
  otherExpenses.value = Number(data.other_budget) || 0

  resetLifestyleSelections()
}

let loadVersion = 0

async function loadSelectedUniversityData() {
  const currentVersion = ++loadVersion

  errorMessage.value = ''
  successMessage.value = ''
  publishedCost.value = null
  exchangePeriods.value = []
  selectedPeriodId.value = ''

  clearBudgetInputs()
  resetLifestyleSelections()
  durationMonths.value = 1
  exchangeRate.value = 1

  if (!selectedUniversityId.value) return

  try {
    await Promise.all([
      loadPublishedCost(),
      loadExchangePeriods(),
    ])

    if (currentVersion !== loadVersion) return

    await loadSavedBudget()

    if (currentVersion !== loadVersion) return

    if (selectedPeriod.value) {
      applyPeriodDuration(selectedPeriod.value)
    }

    await loadExchangeRate()
  } catch (error) {
    console.error('Error loading cost estimator:', error)

    if (currentVersion === loadVersion) {
      errorMessage.value =
        error.message || 'Unable to load the university budget information.'
    }
  }
}

watch(selectedUniversityId, async (newId, oldId) => {
  if (newId !== oldId) {
    if (newId) {
      await loadSelectedUniversityData()
    } else {
      ++loadVersion
      publishedCost.value = null
      exchangePeriods.value = []
      selectedPeriodId.value = ''
      durationMonths.value = 1
      clearBudgetInputs()
      resetLifestyleSelections()
      exchangeRate.value = 1
      errorMessage.value = ''
      successMessage.value = ''
    }
  }
})

watch(selectedPeriodId, newId => {
  if (!newId) return

  const period = exchangePeriods.value.find(
    item => String(item.id) === String(newId),
  )

  if (period) applyPeriodDuration(period)
})

function usePublishedEstimates() {
  if (!publishedCost.value) return

  accommodation.value = Number(publishedCost.value.accommodation) || 0
  food.value = Number(publishedCost.value.food) || 0
  transport.value = Number(publishedCost.value.transport) || 0
  personalExpenses.value =
    Number(publishedCost.value.personal_expenses) || 0
  otherExpenses.value = Number(publishedCost.value.other_expenses) || 0

  resetLifestyleSelections()

  successMessage.value =
    'Published estimates copied into your budget. Preferences and transport method have been reset. You can edit the amounts before saving.'
}

async function saveBudget() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!selectedUniversityId.value) {
    errorMessage.value = 'Please select a destination university before saving.'
    return
  }

  if (!validBudget.value) {
    errorMessage.value =
      'Please enter a valid duration from 1 to 12 months. Expenses cannot be negative.'
    return
  }

  saving.value = true

  try {
    const { data: userResult, error: userError } =
      await supabase.auth.getUser()

    if (userError) throw userError

    const user = userResult?.user

    if (!user) {
      throw new Error('Please log in before saving your budget.')
    }

    const payload = {
      user_id: user.id,
      university_id: Number(selectedUniversityId.value),
      exchange_period_id: selectedPeriodId.value
        ? Number(selectedPeriodId.value)
        : null,
      duration_months: Number(durationMonths.value),
      currency_code: currencyCode.value,
      total_budget: totalExchangeBudget.value,
      accommodation_budget: Number(accommodation.value),
      food_budget: Number(food.value),
      transport_budget: Number(transport.value),
      personal_budget: Number(personalExpenses.value),
      other_budget: Number(otherExpenses.value),
    }

    const { error } = await supabase
  .from('user_budgets')
  .upsert(payload, {
    onConflict: 'user_id,university_id',
  })

if (error) throw error

    successMessage.value = 'Your budget has been saved successfully.'
  } catch (error) {
    console.error('Error saving budget:', error)
    errorMessage.value =
      error.message || 'Unable to save your budget. Please try again.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    await loadUniversities()
  } catch (error) {
    console.error('Initial cost estimator load failed:', error)
    errorMessage.value =
      error.message || 'Unable to load the cost estimator.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="container py-4 py-lg-5">
    <div class="mb-4">

      <h1 class="fw-bold mb-2">Exchange Budget Planner</h1>

      <p class="text-secondary mb-0">
        Estimate your exchange expenses, compare published costs,
        and plan your budget before you go.
      </p>
    </div>

    <div
      v-if="loading"
      class="d-flex flex-column align-items-center justify-content-center py-5"
    >
      <div class="spinner-border text-primary mb-3" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>

      <p class="text-secondary mb-0">
        Loading your exchange budget...
      </p>
    </div>

    <template v-else>
      <div
        v-if="errorMessage"
        class="alert alert-danger alert-dismissible"
        role="alert"
      >
        {{ errorMessage }}

        <button
          type="button"
          class="btn-close"
          aria-label="Dismiss"
          @click="errorMessage = ''"
        ></button>
      </div>

      <div
        v-if="successMessage"
        class="alert alert-success alert-dismissible"
        role="status"
      >
        {{ successMessage }}

        <button
          type="button"
          class="btn-close"
          aria-label="Dismiss"
          @click="successMessage = ''"
        ></button>
      </div>

      <div v-if="universities.length === 0" class="alert alert-info">
        No universities are available yet. Please add universities
        to your database before creating a budget.
      </div>

      <div v-else class="row g-4 align-items-start">
        <section class="col-12 col-lg-5">
          <div class="summary-column">
            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-body p-4">
                <p class="text-secondary small mb-1">
                  Your estimated exchange budget
                </p>

                <h2 class="display-6 fw-bold mb-1">
                  {{ formatMoney(totalExchangeBudget) }}
                </h2>

                <p class="text-secondary small mb-0">
                  For {{ durationMonths }} month<span
                    v-if="Number(durationMonths) !== 1"
                  >s</span>
                </p>

                <hr />

                <div class="d-flex justify-content-between gap-3 mb-3">
                  <span class="text-secondary">Monthly budget</span>
                  <strong>{{ formatMoney(monthlyBudget) }}</strong>
                </div>

                <div class="d-flex justify-content-between gap-3 mb-3">
                  <span class="text-secondary">Exchange duration</span>
                  <strong>
                    {{ durationMonths }}
                    month<span v-if="Number(durationMonths) !== 1">s</span>
                  </strong>
                </div>

                <div class="d-flex justify-content-between gap-3">
                  <span class="text-secondary">Estimated in SGD</span>
                  <strong>
                    {{
                      totalBudgetSGD === null
                        ? 'Not available'
                        : formatMoney(totalBudgetSGD, 'SGD')
                    }}
                  </strong>
                </div>

                <p
                  v-if="rateLoading"
                  class="small text-secondary mt-3 mb-0"
                >
                  Updating currency conversion...
                </p>

                <p
                  v-else-if="currencyCode !== 'SGD' && exchangeRate === 1"
                  class="small text-warning mt-3 mb-0"
                >
                  SGD conversion may be unavailable. Check the exchange rate
                  before relying on the converted amount.
                </p>

                <p
                  v-else-if="currencyCode !== 'SGD'"
                  class="small text-secondary mt-3 mb-0"
                >
                  Indicative conversion using the latest available
                  Frankfurter rate. Your bank may use a different rate.
                </p>
              </div>
            </div>

            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-body p-4">
                <div
                  class="d-flex justify-content-between align-items-start gap-2 mb-3"
                >
                  <div>
                    <h2 class="h5 fw-bold mb-1">
                      Estimated university costs
                    </h2>

                    <p class="small text-secondary mb-0">
                      {{ selectedUniversity?.name || 'Select a university to view costs' }}
                    </p>
                  </div>

                  <span class="badge text-bg-light border">
                    Published estimate
                  </span>
                </div>

                <div v-if="!selectedUniversityId">
                  <p class="text-secondary mb-0">
                    Choose a destination university on the right to view
                    its available cost estimates.
                  </p>
                </div>

                <div v-else-if="!publishedCost">
                  <p class="text-secondary mb-0">
                    No published cost estimate is available for this
                    university yet.
                  </p>
                </div>

                <div v-else>
                  <div
                    v-for="item in [
                      { label: 'Accommodation', value: publishedCost.accommodation },
                      { label: 'Food', value: publishedCost.food },
                      { label: 'Transport', value: publishedCost.transport },
                      { label: 'Personal expenses', value: publishedCost.personal_expenses },
                      { label: 'Other expenses', value: publishedCost.other_expenses }
                    ]"
                    :key="item.label"
                    class="d-flex justify-content-between gap-3 mb-3"
                  >
                    <span class="text-secondary">{{ item.label }}</span>

                    <span class="fw-semibold text-end">
                      {{
                        item.value === null || item.value === undefined
                          ? '—'
                          : formatMoney(item.value)
                      }}
                    </span>
                  </div>

                  <hr />

                  <div class="d-flex justify-content-between gap-3 mb-2">
                    <span class="fw-semibold">Estimated monthly total</span>
                    <strong>
                      {{
                        publishedMonthlyCost === null
                          ? 'Not available'
                          : formatMoney(publishedMonthlyCost)
                      }}
                    </strong>
                  </div>

                  <div class="d-flex justify-content-between gap-3">
                    <span class="fw-semibold">
                      Estimated total for your period
                    </span>

                    <strong class="text-primary text-end">
                      {{
                        publishedTotalCost === null
                          ? 'Not available'
                          : formatMoney(publishedTotalCost)
                      }}
                    </strong>
                  </div>

                  <div
                    v-if="publishedTotalSGD !== null && currencyCode !== 'SGD'"
                    class="d-flex justify-content-between gap-3 mt-2"
                  >
                    <span class="small text-secondary">
                      Approximate SGD total
                    </span>

                    <span class="small fw-semibold">
                      {{ formatMoney(publishedTotalSGD, 'SGD') }}
                    </span>
                  </div>

                  <button
                    type="button"
                    class="btn btn-outline-primary w-100 mt-4"
                    @click="usePublishedEstimates"
                  >
                    Use Published Estimates
                  </button>

                  <p class="small text-secondary mt-3 mb-0">
                    Check the original source and reporting period before
                    using these estimates. They may not reflect current prices.
                  </p>
                </div>
              </div>
            </div>

            <div
              v-if="publishedTotalCost !== null"
              class="card border-0 shadow-sm rounded-4"
            >
              <div class="card-body p-4">
                <h2 class="h5 fw-bold mb-3">Budget comparison</h2>

                <div class="d-flex justify-content-between gap-3 mb-3">
                  <span class="text-secondary">Your budget</span>
                  <strong class="text-end">
                    {{ formatMoney(totalExchangeBudget) }}
                  </strong>
                </div>

                <div class="d-flex justify-content-between gap-3 mb-3">
                  <span class="text-secondary">Published estimate</span>
                  <strong class="text-end">
                    {{ formatMoney(publishedTotalCost) }}
                  </strong>
                </div>

                <div
                  class="rounded-3 p-3"
                  :class="{
                    'comparison-below': budgetStatus === 'below',
                    'comparison-above': budgetStatus === 'above',
                    'comparison-equal': budgetStatus === 'equal'
                  }"
                >
                  <p class="small mb-1">
                    {{
                      budgetStatus === 'below'
                        ? 'Your budget is below the published estimate by'
                        : budgetStatus === 'above'
                          ? 'Your budget is above the published estimate by'
                          : 'Your budget matches the published estimate'
                    }}
                  </p>

                  <strong>
                    {{ formatMoney(Math.abs(remainingBudget)) }}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="col-12 col-lg-7">
          <div class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-4 p-md-5">
              <div class="mb-4">
                <h2 class="h4 fw-bold mb-2">Plan your expenses</h2>

                <p class="text-secondary mb-0">
                  Select your destination and exchange period, then
                  customise your monthly expenses. Preferences are optional.
                </p>
              </div>

              <form @submit.prevent="saveBudget">
                <div class="mb-4">
                  <label for="university" class="form-label fw-semibold">
                    Destination university
                  </label>

                  <select
                    id="university"
                    v-model="selectedUniversityId"
                    class="form-select form-select-lg"
                  >
                    <option value="">Select a university</option>

                    <option
                      v-for="university in universities"
                      :key="university.id"
                      :value="String(university.id)"
                    >
                      {{ university.name }} — {{ university.country }}
                    </option>
                  </select>

                  <div
                    v-if="selectedUniversity"
                    class="small text-secondary mt-2"
                  >
                    <span v-if="selectedUniversity.city">
                      {{ selectedUniversity.city }},
                    </span>

                    {{ selectedUniversity.country }}

                    <span v-if="selectedUniversity.region">
                      · {{ selectedUniversity.region }}
                    </span>
                  </div>
                </div>

                <div class="mb-4">
                  <label for="exchangePeriod" class="form-label fw-semibold">
                    Exchange period
                    <span class="optional-label">(optional)</span>
                  </label>

                  <select
                    id="exchangePeriod"
                    v-model="selectedPeriodId"
                    class="form-select form-select-lg"
                    :disabled="!selectedUniversityId || exchangePeriods.length === 0"
                  >
                    <option value="">Select a period (optional)</option>

                    <option
                      v-for="period in exchangePeriods"
                      :key="period.id"
                      :value="String(period.id)"
                    >
                      {{ period.period_name }}
                      <template v-if="period.term">
                        — {{ period.term }}
                      </template>
                      <template v-if="period.academic_year">
                        ({{ period.academic_year }})
                      </template>
                    </option>
                  </select>

                  <div
                    v-if="selectedPeriod"
                    class="period-details rounded-3 p-3 mt-3"
                  >
                    <div class="mb-3">
                      <div class="small text-secondary">Exchange dates</div>
                      <div class="fw-semibold">
                        {{ formatDate(selectedPeriod.start_date) }}
                        –
                        {{ formatDate(selectedPeriod.end_date) }}
                      </div>
                    </div>

                    <div>
                      <div class="small text-secondary">
                        Calculated duration
                      </div>
                      <div class="fw-semibold">
                        {{ durationMonths }}
                        month<span v-if="Number(durationMonths) !== 1">s</span>
                      </div>
                    </div>

                    <p class="small text-secondary mt-2 mb-0">
                      Duration updates automatically from the selected dates.
                      You can adjust it below.
                    </p>
                  </div>

                  <p
                    v-else-if="selectedUniversityId && exchangePeriods.length === 0"
                    class="form-text"
                  >
                    No exchange periods are available for this university.
                    You can enter the duration manually.
                  </p>
                </div>

                <div class="mb-4">
                  <label for="duration" class="form-label fw-semibold">
                    Exchange duration (months)
                  </label>

                  <input
                    id="duration"
                    v-model.number="durationMonths"
                    type="number"
                    class="form-control form-control-lg"
                    min="1"
                    max="12"
                    step="1"
                    required
                  />

                  <div class="form-text">
                    Choose an exchange period to calculate the duration
                    automatically, or enter the duration yourself.
                  </div>
                </div>

                <hr class="my-4" />

                <div class="mb-4">
                  <h3 class="h5 fw-bold mb-1">Monthly expenses</h3>

                  <p class="small text-secondary mb-0">
                    All lifestyle dropdowns are optional. Leave them blank
                    and enter your own amounts if you prefer.
                  </p>
                </div>

                <div class="mb-3">
                  <label for="housingType" class="form-label fw-semibold">
                    Accommodation type
                    <span class="optional-label">(optional)</span>
                  </label>

                  <select
                    id="housingType"
                    v-model="housingType"
                    class="form-select form-select-lg"
                    @change="updateAccommodationPrice"
                  >
                    <option value="">Select accommodation (optional)</option>

                    <option
                      v-for="option in housingOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>

                  <div class="form-text">
                    Choose a private room, whole house, shared accommodation,
                    studio apartment, university dormitory, or homestay.
                  </div>
                </div>

                <div class="mb-4">
                  <label for="accommodation" class="form-label">
                    Monthly accommodation cost
                  </label>

                  <div class="input-group input-group-lg">
                    <span class="input-group-text">{{ currencyCode }}</span>

                    <input
                      id="accommodation"
                      v-model.number="accommodation"
                      type="number"
                      class="form-control"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  <div class="form-text">
                    Enter your estimated monthly rent and accommodation fees.
                  </div>
                </div>

                <div class="mb-3">
                  <label for="foodOption" class="form-label fw-semibold">
                    Food preference
                    <span class="optional-label">(optional)</span>
                  </label>

                  <select
                    id="foodOption"
                    v-model="foodOption"
                    class="form-select form-select-lg"
                    @change="updateFoodPrice"
                  >
                    <option value="">Select food preference (optional)</option>

                    <option
                      v-for="option in foodOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </div>

                <div class="mb-4">
                  <label for="food" class="form-label">
                    Monthly food and groceries cost
                  </label>

                  <div class="input-group input-group-lg">
                    <span class="input-group-text">{{ currencyCode }}</span>

                    <input
                      id="food"
                      v-model.number="food"
                      type="number"
                      class="form-control"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div class="mb-3">
                  <label for="transportOption" class="form-label fw-semibold">
                    Transport method
                    <span class="optional-label">(optional)</span>
                  </label>

                  <select
                    id="transportOption"
                    v-model="transportOption"
                    class="form-select form-select-lg"
                    @change="updateTransportPrice"
                  >
                    <option value="">Select transport (optional)</option>

                    <option
                      v-for="option in transportOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </div>

                <div class="mb-4">
                  <label for="transport" class="form-label">
                    Monthly transport cost
                  </label>

                  <div class="input-group input-group-lg">
                    <span class="input-group-text">{{ currencyCode }}</span>

                    <input
                      id="transport"
                      v-model.number="transport"
                      type="number"
                      class="form-control"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div class="mb-3">
                  <label for="personalExpenses" class="form-label">
                    Personal expenses
                  </label>

                  <div class="input-group input-group-lg">
                    <span class="input-group-text">{{ currencyCode }}</span>

                    <input
                      id="personalExpenses"
                      v-model.number="personalExpenses"
                      type="number"
                      class="form-control"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div class="mb-4">
                  <label for="otherExpenses" class="form-label">
                    Other expenses
                  </label>

                  <div class="input-group input-group-lg">
                    <span class="input-group-text">{{ currencyCode }}</span>

                    <input
                      id="otherExpenses"
                      v-model.number="otherExpenses"
                      type="number"
                      class="form-control"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div class="form-total rounded-3 p-3 mb-4">
                  <div
                    class="d-flex justify-content-between align-items-center gap-3 mb-2"
                  >
                    <span class="text-secondary">Monthly total</span>
                    <strong>{{ formatMoney(monthlyBudget) }}</strong>
                  </div>

                  <div
                    class="d-flex justify-content-between align-items-center gap-3"
                  >
                    <span class="fw-semibold">Total for exchange</span>
                    <strong class="fs-5 text-primary text-end">
                      {{ formatMoney(totalExchangeBudget) }}
                    </strong>
                  </div>

                  <div
                    v-if="totalBudgetSGD !== null && currencyCode !== 'SGD'"
                    class="d-flex justify-content-between align-items-center gap-3 mt-2"
                  >
                    <span class="small text-secondary">
                      Approximate total in SGD
                    </span>

                    <strong class="small">
                      {{ formatMoney(totalBudgetSGD, 'SGD') }}
                    </strong>
                  </div>
                </div>

                <button
                  type="submit"
                  class="btn btn-primary btn-lg w-100"
                  :disabled="saving || !validBudget"
                >
                  <span
                    v-if="saving"
                    class="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  ></span>

                  {{ saving ? 'Saving budget...' : 'Save My Budget' }}
                </button>

                <p class="small text-secondary text-center mt-3 mb-0">
                  Choose a destination university before saving. Exchange
                  period and lifestyle preferences can remain blank.
                </p>
              </form>
            </div>
          </div>
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.summary-column {
  position: sticky;
  top: 1.5rem;
}

.optional-label {
  font-size: 0.82rem;
  font-weight: 400;
  color: #6c757d;
}

.period-details,
.form-total {
  background: #f7f8fc;
  border: 1px solid #e8eaf0;
}

.comparison-below {
  background: #e8f6ee;
  color: #17663a;
}

.comparison-above {
  background: #fff0ed;
  color: #a32e20;
}

.comparison-equal {
  background: #edf2ff;
  color: #2448a5;
}

.form-control,
.form-select,
.input-group-text {
  min-width: 0;
}

.form-select:disabled {
  background-color: #f5f6f8;
  cursor: not-allowed;
}

@media (max-width: 991.98px) {
  .summary-column {
    position: static;
  }
}

@media (max-width: 575.98px) {
  main.container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .display-6 {
    font-size: 1.9rem;
  }

  .card-body {
    padding: 1.25rem !important;
  }

  .input-group-lg > .form-control,
  .input-group-lg > .input-group-text {
    font-size: 1rem;
  }
}
</style>