<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import BudgetNotice from '@/components/BudgetNotice.vue'
import DeleteBudgetDialog from '@/components/DeleteBudgetDialog.vue'
import SavedBudgetsPanel from '@/components/SavedBudgetsPanel.vue'
import BudgetSummaryPanel from '@/components/BudgetSummaryPanel.vue'
import BudgetPlannerForm from '@/components/BudgetPlannerForm.vue'
import BudgetDetailsDialog from '@/components/BudgetDetailsDialog.vue'

const auth = useAuthStore()
const allUniversities = ref([])
const universities = computed(() => allUniversities.value.filter((university) =>
  auth.adminActive || university.published !== false
))
const exchangePeriods = ref([])
const publishedCost = ref(null)

const selectedUniversityId = ref('')
const selectedPeriodId = ref('')
const durationMonths = ref(1)

watch(() => auth.adminActive, (adminActive) => {
  if (adminActive) return
  const selected = allUniversities.value.find((university) =>
    String(university.id) === String(selectedUniversityId.value)
  )
  if (selected?.published === false) {
    selectedUniversityId.value = ''
    selectedPeriodId.value = ''
    publishedCost.value = null
  }
})

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
const currentView = ref('list')
const savedBudgets = ref([])
const budgetsLoading = ref(false)
const budgetSearchQuery = ref('')
const selectedRegionFilter = ref('')
const budgetSortBy = ref('recent')
const editingBudgetId = ref(null)
const deletingBudgetId = ref(null)
const budgetToDelete = ref(null)
const budgetToRead = ref(null)

const errorMessage = ref('')
const successMessage = ref('')
const visibleSavedBudgets = computed(() => auth.adminActive
  ? savedBudgets.value
  : savedBudgets.value.filter((budget) => universities.value.some((university) =>
      String(university.id) === String(budget.university_id)
    ))
)

// Automatically dismiss success/error notifications after five seconds.
// Users can also close either notification immediately with its X button.
let noticeTimeout = null
watch([errorMessage, successMessage], ([error, success]) => {
  if (noticeTimeout) {
    clearTimeout(noticeTimeout)
    noticeTimeout = null
  }

  if (!error && !success) return

  const errorAtSchedule = error
  const successAtSchedule = success
  noticeTimeout = setTimeout(() => {
    if (errorMessage.value === errorAtSchedule) errorMessage.value = ''
    if (successMessage.value === successAtSchedule) successMessage.value = ''
    noticeTimeout = null
  }, 5000)
})

onUnmounted(() => {
  if (noticeTimeout) clearTimeout(noticeTimeout)
})

const housingOptions = [
  { value: 'one-room', label: 'One Room', multiplier: 1 },
  { value: 'whole-house', label: 'Whole House', multiplier: 2.2 },
  { value: 'share', label: 'Shared Accommodation', multiplier: 0.65 },
  { value: 'studio', label: 'Studio Apartment', multiplier: 1.4 },
  { value: 'dormitory', label: 'University Dormitory', multiplier: 0.7 },
  { value: 'homestay', label: 'Homestay', multiplier: 1.1 },
]

const foodOptions = [
  { value: 'cook', label: 'Cook at Home', multiplier: 0.7 },
  { value: 'mixed', label: 'Mix of Home Cooking and Eating Out', multiplier: 1 },
  { value: 'eat-out', label: 'Eat Out Regularly', multiplier: 1.25 },
  { value: 'street-food', label: 'Street Food / Budget Meals', multiplier: 0.8 },
  { value: 'restaurant', label: 'Restaurants', multiplier: 1.6 },
  { value: 'cafe', label: 'Cafes', multiplier: 1.3 },
]

const transportOptions = [
  { value: 'bus', label: 'Bus', multiplier: 0.55 },
  { value: 'train', label: 'Train / Metro', multiplier: 0.75 },
  { value: 'walk', label: 'Walking / Cycling', multiplier: 0.2 },
  { value: 'cab', label: 'Cab / Taxi', multiplier: 1.8 },
  { value: 'rent-car', label: 'Rental Car', multiplier: 2.5 },
  { value: 'mixed', label: 'Mixed Transport', multiplier: 1 },
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

const availableBudgetRegions = computed(() =>
  [...new Set(visibleSavedBudgets.value.map(budget => budget.university_region).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)),
)

const filteredBudgets = computed(() => {
  const query = budgetSearchQuery.value.trim().toLocaleLowerCase()
  const filtered = visibleSavedBudgets.value.filter(budget => {
    const matchesRegion =
      !selectedRegionFilter.value || budget.university_region === selectedRegionFilter.value
    const searchableText = [
      budget.university_name,
      budget.university_country,
      budget.university_region,
      budget.period_name,
    ].filter(Boolean).join(' ').toLocaleLowerCase()
    return matchesRegion && (!query || searchableText.includes(query))
  })

  return filtered.sort((a, b) => {
    if (budgetSortBy.value === 'name') {
      return a.university_name.localeCompare(b.university_name)
    }
    if (budgetSortBy.value === 'country') {
      return a.university_country.localeCompare(b.university_country) ||
        a.university_name.localeCompare(b.university_name)
    }
    if (budgetSortBy.value === 'cost') {
      return Number(a.total_budget || 0) - Number(b.total_budget || 0)
    }
    // IDs are generated in insertion order, so descending IDs act as a
    // recently-added fallback when the table has no created_at column.
    return Number(b.id) - Number(a.id)
  })
})

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
    .select('id, name, country, state, city, region, website_url, published')
    .order('name')

  if (error) throw error

  allUniversities.value = data || []
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

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data?.user) throw new Error('Please log in to manage your budgets.')
  return data.user
}

async function loadBudgets() {
  budgetsLoading.value = true
  try {
    const user = await getCurrentUser()
    const { data, error } = await supabase
      .from('user_budgets')
      .select('id, university_id, exchange_period_id, duration_months, currency_code, total_budget, accommodation_budget, food_budget, transport_budget, personal_budget, other_budget, housing_type, food_option, transport_option')
      .eq('user_id', user.id)
      .order('id', { ascending: false })
    if (error) throw error

    // The form's exchangePeriods list only contains periods for the currently
    // selected university. Load all periods separately so the table can show
    // the correct period for every saved budget, including different universities.
    const { data: allPeriods, error: periodsError } = await supabase
      .from('exchange_periods')
      .select('id, university_id, period_name, term, academic_year, start_date, end_date')
    if (periodsError) throw periodsError

    const periodsById = new Map(
      (allPeriods || []).map(period => [String(period.id), period]),
    )

    savedBudgets.value = (data || []).map(budget => {
      const university = universities.value.find(item => String(item.id) === String(budget.university_id))
      const period = periodsById.get(String(budget.exchange_period_id))
      const monthly = ['accommodation_budget', 'food_budget', 'transport_budget', 'personal_budget', 'other_budget']
        .reduce((sum, key) => sum + Number(budget[key] || 0), 0)
      return {
        ...budget,
        university_name: university?.name || `University #${budget.university_id}`,
        university_country: university?.country || '',
        university_region: university?.region || '',
        period_name: period
          ? [
              period.period_name,
              period.term,
              period.academic_year ? `(${period.academic_year})` : '',
            ].filter(Boolean).join(' — ').replace(/ — \(/g, ' (')
          : '',
        total_budget: budget.total_budget == null ? monthly * (Number(budget.duration_months) || 1) : Number(budget.total_budget),
      }
    })
  } catch (error) {
    console.error('Unable to load saved budgets:', error)
    errorMessage.value = error.message || 'Unable to load your saved budgets.'
  } finally {
    budgetsLoading.value = false
  }
}

function resetBudgetForm() {
  editingBudgetId.value = null
  selectedUniversityId.value = ''
  selectedPeriodId.value = ''
  durationMonths.value = 1
  clearBudgetInputs()
  resetLifestyleSelections()
  publishedCost.value = null
  exchangePeriods.value = []
  exchangeRate.value = 1
  errorMessage.value = ''
  successMessage.value = ''
}

function createNewBudget() {
  resetBudgetForm()
  currentView.value = 'planner'
}

async function editBudget(budget) {
  errorMessage.value = ''
  successMessage.value = ''
  editingBudgetId.value = budget.id
  currentView.value = 'planner'
  selectedUniversityId.value = String(budget.university_id)
  await loadSelectedUniversityData()

  selectedPeriodId.value = budget.exchange_period_id ? String(budget.exchange_period_id) : ''
  durationMonths.value = Math.min(12, Math.max(1, Number(budget.duration_months) || 1))
  accommodation.value = Number(budget.accommodation_budget) || 0
  food.value = Number(budget.food_budget) || 0
  transport.value = Number(budget.transport_budget) || 0
  personalExpenses.value = Number(budget.personal_budget) || 0
  otherExpenses.value = Number(budget.other_budget) || 0
  // Restore saved dropdown choices so editing preserves every form input.
  housingType.value = budget.housing_type || ''
  foodOption.value = budget.food_option || ''
  transportOption.value = budget.transport_option || ''
}

function deleteBudget(budget) {
  // Open the app's own confirmation card instead of the browser's confirm popup.
  budgetToDelete.value = budget
}

function readBudget(budget) {
  budgetToRead.value = budget
}

function closeBudgetDetails() {
  budgetToRead.value = null
}

function cancelDeleteBudget() {
  if (deletingBudgetId.value !== null) return
  budgetToDelete.value = null
}

async function confirmDeleteBudget() {
  const budget = budgetToDelete.value
  if (!budget) return

  deletingBudgetId.value = budget.id
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const user = await getCurrentUser()
    const { error } = await supabase
      .from('user_budgets')
      .delete()
      .eq('id', budget.id)
      .eq('user_id', user.id)

    if (error) throw error

    savedBudgets.value = savedBudgets.value.filter(item => item.id !== budget.id)
    budgetToDelete.value = null
    successMessage.value = 'Budget deleted successfully.'
  } catch (error) {
    console.error('Unable to delete budget:', error)
    errorMessage.value = error.message || 'Unable to delete this budget.'
  } finally {
    deletingBudgetId.value = null
  }
}

async function saveBudget() {
  errorMessage.value = ''
  successMessage.value = ''
  if (!selectedUniversityId.value) {
    errorMessage.value = 'Please select a destination university before saving.'
    return
  }
  if (!validBudget.value) {
    errorMessage.value = 'Please enter a valid duration from 1 to 12 months. Expenses cannot be negative.'
    return
  }

  saving.value = true
  try {
    const user = await getCurrentUser()
    const payload = {
      user_id: user.id,
      university_id: Number(selectedUniversityId.value),
      exchange_period_id: selectedPeriodId.value ? Number(selectedPeriodId.value) : null,
      duration_months: Number(durationMonths.value),
      currency_code: currencyCode.value,
      total_budget: totalExchangeBudget.value,
      accommodation_budget: Number(accommodation.value),
      food_budget: Number(food.value),
      transport_budget: Number(transport.value),
      personal_budget: Number(personalExpenses.value),
      other_budget: Number(otherExpenses.value),
      // Save optional lifestyle selections alongside the expense amounts.
      housing_type: housingType.value || null,
      food_option: foodOption.value || null,
      transport_option: transportOption.value || null,
    }

    const query = editingBudgetId.value
      ? supabase.from('user_budgets').update(payload).eq('id', editingBudgetId.value).eq('user_id', user.id)
      : supabase.from('user_budgets').insert(payload)
    const { error } = await query
    if (error) throw error

    const savedMessage = editingBudgetId.value
      ? 'Your budget has been updated successfully.'
      : 'Your new budget has been created successfully.'
    // Switch back to the table after the database write succeeds.
    currentView.value = 'list'
    resetBudgetForm()
    await loadBudgets()
    // loadBudgets can show its own error, so restore the save confirmation after it completes.
    errorMessage.value = ''
    successMessage.value = savedMessage
    // Wait for the list view and notification to render, then scroll to the top.
    await nextTick()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    console.error('Error saving budget:', error)
    errorMessage.value = error.message || 'Unable to save your budget. Please try again.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    await loadUniversities()
    await loadBudgets()
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
  <main class="container px-0">
    <div class="mb-3">

      <h1 class="page-title h3 fw-bold text-center mb-3">Exchange Budget Planner</h1>

      <p class="text-secondary text-center mb-0">
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
      <BudgetNotice
        :error-message="errorMessage"
        :success-message="successMessage"
        @dismiss-error="errorMessage = ''"
        @dismiss-success="successMessage = ''"
      />

      <DeleteBudgetDialog
        :budget="budgetToDelete"
        :deleting="deletingBudgetId !== null"
        @cancel="cancelDeleteBudget"
        @confirm="confirmDeleteBudget"
      />

      <BudgetDetailsDialog
        :budget="budgetToRead"
        :format-money="formatMoney"
        @close="closeBudgetDetails"
      />

      <SavedBudgetsPanel
        v-if="currentView === 'list'"
        v-model:search-query="budgetSearchQuery"
        v-model:region-filter="selectedRegionFilter"
        v-model:sort-by="budgetSortBy"
        :budgets="visibleSavedBudgets"
        :filtered-budgets="filteredBudgets"
        :regions="availableBudgetRegions"
        :loading="budgetsLoading"
        :deleting-budget-id="deletingBudgetId"
        :format-money="formatMoney"
        @create="createNewBudget"
        @read="readBudget"
        @edit="editBudget"
        @delete="deleteBudget"
      />

      <div v-if="currentView === 'planner' && universities.length === 0" class="alert alert-info">
        No partner universities are available yet. Please add partner universities
        to your database before creating a budget.
      </div>

      <div v-if="currentView === 'planner' && universities.length > 0" class="mb-3">
        <button type="button" class="btn btn-outline-secondary" @click="currentView = 'list'; loadBudgets()">← Back to My Budgets</button>
      </div>

      <div v-if="currentView === 'planner' && universities.length > 0" class="row g-4 align-items-start">
        <BudgetSummaryPanel
          :selected-university="selectedUniversity"
          :selected-university-id="selectedUniversityId"
          :duration-months="durationMonths"
          :total-exchange-budget="totalExchangeBudget"
          :monthly-budget="monthlyBudget"
          :total-budget-s-g-d="totalBudgetSGD"
          :rate-loading="rateLoading"
          :currency-code="currencyCode"
          :exchange-rate="exchangeRate"
          :published-cost="publishedCost"
          :published-monthly-cost="publishedMonthlyCost"
          :published-total-cost="publishedTotalCost"
          :published-total-s-g-d="publishedTotalSGD"
          :remaining-budget="remainingBudget"
          :budget-status="budgetStatus"
          :format-money="formatMoney"
          @use-published-estimates="usePublishedEstimates"
        />

        <section class="col-12 col-lg-7">
        <BudgetPlannerForm
          v-model:selected-university-id="selectedUniversityId"
          v-model:selected-period-id="selectedPeriodId"
          v-model:duration-months="durationMonths"
          v-model:housing-type="housingType"
          v-model:food-option="foodOption"
          v-model:transport-option="transportOption"
          v-model:accommodation="accommodation"
          v-model:food="food"
          v-model:transport="transport"
          v-model:personal-expenses="personalExpenses"
          v-model:other-expenses="otherExpenses"
          :universities="universities"
          :exchange-periods="exchangePeriods"
          :selected-university="selectedUniversity"
          :selected-period="selectedPeriod"
          :currency-code="currencyCode"
          :monthly-budget="monthlyBudget"
          :total-exchange-budget="totalExchangeBudget"
          :total-budget-s-g-d="totalBudgetSGD"
          :saving="saving"
          :editing-budget-id="editingBudgetId"
          :valid-budget="validBudget"
          :housing-options="housingOptions"
          :food-options="foodOptions"
          :transport-options="transportOptions"
          :format-money="formatMoney"
          :format-date="formatDate"
          @submit="saveBudget"
          @update-accommodation-price="updateAccommodationPrice"
          @update-food-price="updateFoodPrice"
          @update-transport-price="updateTransportPrice"
        />
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
@media (max-width: 575.98px) {
  main.container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .display-6 {
    font-size: 1.9rem;
  }

}
</style>
