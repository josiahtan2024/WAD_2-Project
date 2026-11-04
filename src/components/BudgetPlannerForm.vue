<script setup>
defineProps({
  universities: { type: Array, default: () => [] },
  exchangePeriods: { type: Array, default: () => [] },
  selectedUniversity: { type: Object, default: null },
  selectedPeriod: { type: Object, default: null },
  currencyCode: { type: String, default: 'SGD' },
  monthlyBudget: { type: Number, default: 0 },
  totalExchangeBudget: { type: Number, default: 0 },
  totalBudgetSGD: { type: Number, default: null },
  saving: { type: Boolean, default: false },
  editingBudgetId: { type: [String, Number], default: null },
  validBudget: { type: Boolean, default: false },
  housingOptions: { type: Array, default: () => [] },
  foodOptions: { type: Array, default: () => [] },
  transportOptions: { type: Array, default: () => [] },
  formatMoney: { type: Function, required: true },
  formatDate: { type: Function, required: true },
})
const selectedUniversityId = defineModel('selectedUniversityId', {
  type: [String, Number],
  default: '',
})
const selectedPeriodId = defineModel('selectedPeriodId', { type: [String, Number], default: '' })
const durationMonths = defineModel('durationMonths', { type: [String, Number], default: 1 })
const housingType = defineModel('housingType', { type: String, default: '' })
const foodOption = defineModel('foodOption', { type: String, default: '' })
const transportOption = defineModel('transportOption', { type: String, default: '' })
const accommodation = defineModel('accommodation', { type: [String, Number], default: 0 })
const food = defineModel('food', { type: [String, Number], default: 0 })
const transport = defineModel('transport', { type: [String, Number], default: 0 })
const personalExpenses = defineModel('personalExpenses', { type: [String, Number], default: 0 })
const otherExpenses = defineModel('otherExpenses', { type: [String, Number], default: 0 })
const emit = defineEmits([
  'submit',
  'update-accommodation-price',
  'update-food-price',
  'update-transport-price',
])
</script>

<template>
  <form class="card border rounded-4 shadow-sm p-4 bg-white" @submit.prevent="emit('submit')">
    <div class="mb-4">
      <label for="university" class="form-label fw-semibold small text-navy"> Destination University </label>

      <select
        id="university"
        data-testid="budget-university-select"
        v-model="selectedUniversityId"
        class="form-select shadow-none"
      >
        <option value="">Select a University</option>

        <option
          v-for="university in universities"
          :key="university.id"
          :value="String(university.id)"
        >
          {{ university.name }} — {{ university.country }}
        </option>
      </select>

      <div v-if="selectedUniversity" class="small text-muted mt-2">
        <i class="bi bi-geo-alt text-primary me-1"></i>
        <span v-if="selectedUniversity.city"> {{ selectedUniversity.city }}, </span>
        {{ selectedUniversity.country }}
        <span v-if="selectedUniversity.region"> · {{ selectedUniversity.region }} </span>
      </div>
    </div>

    <div class="mb-4">
      <label for="exchangePeriod" class="form-label fw-semibold small text-navy">
        Exchange Period
        <span class="optional-label ms-1">(Optional)</span>
      </label>

      <select
        id="exchangePeriod"
        v-model="selectedPeriodId"
        class="form-select shadow-none"
        :disabled="!selectedUniversityId || exchangePeriods.length === 0"
      >
        <option value="">Select a Period (Optional)</option>

        <option v-for="period in exchangePeriods" :key="period.id" :value="String(period.id)">
          {{ period.period_name }}
          <template v-if="period.term"> — {{ period.term }} </template>
          <template v-if="period.academic_year"> ({{ period.academic_year }}) </template>
        </option>
      </select>

      <div v-if="selectedPeriod" class="period-details rounded-3 p-3 mt-3 border bg-light">
        <div class="mb-2 d-flex justify-content-between align-items-center">
          <span class="small text-muted">Exchange dates</span>
          <span class="fw-semibold small text-navy">
            {{ formatDate(selectedPeriod.start_date) }} – {{ formatDate(selectedPeriod.end_date) }}
          </span>
        </div>

        <div class="d-flex justify-content-between align-items-center">
          <span class="small text-muted">Calculated duration</span>
          <span class="fw-semibold small text-navy">
            {{ durationMonths }} month<span v-if="Number(durationMonths) !== 1">s</span>
          </span>
        </div>

        <p class="small text-muted mt-2 mb-0 fs-8 border-top pt-2">
          Duration updates automatically from the selected dates. You can adjust it below.
        </p>
      </div>

      <p v-else-if="selectedUniversityId && exchangePeriods.length === 0" class="form-text small text-muted">
        No exchange periods are available for this university. You can enter the duration manually.
      </p>
    </div>

    <div class="mb-4">
      <label for="duration" class="form-label fw-semibold small text-navy"> Exchange Duration (Months) </label>

      <input
        id="duration"
        data-testid="budget-duration-input"
        v-model.number="durationMonths"
        type="number"
        class="form-control shadow-none"
        min="1"
        max="12"
        step="1"
        required
      />

      <div class="form-text small text-muted">
        Choose an exchange period to calculate duration, or enter it manually.
      </div>
    </div>

    <hr class="my-4 border-secondary border-opacity-10" />

    <div class="mb-4">
      <h3 class="h6 fw-bold text-navy mb-1">Monthly Expenses</h3>

      <p class="small text-muted mb-0">
        All lifestyle dropdowns are optional. Leave them blank and enter your own amounts if preferred.
      </p>
    </div>

    <!-- Housing -->
    <div class="mb-3">
      <label for="housingType" class="form-label fw-semibold small text-navy">
        Accommodation Type
        <span class="optional-label ms-1">(Optional)</span>
      </label>

      <select
        id="housingType"
        v-model="housingType"
        class="form-select shadow-none"
        @change="emit('update-accommodation-price')"
      >
        <option value="">Select Accommodation (Optional)</option>

        <option v-for="option in housingOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="mb-4">
      <label for="accommodation" class="form-label small text-secondary"> Monthly Accommodation Cost </label>

      <div class="input-group">
        <span class="input-group-text bg-light text-navy fw-semibold small">{{ currencyCode }}</span>

        <input
          id="accommodation"
          data-testid="budget-accommodation-input"
          v-model.number="accommodation"
          type="number"
          class="form-control shadow-none"
          min="0"
          step="0.01"
          required
        />
      </div>
    </div>

    <!-- Food -->
    <div class="mb-3">
      <label for="foodOption" class="form-label fw-semibold small text-navy">
        Food Preference
        <span class="optional-label ms-1">(Optional)</span>
      </label>

      <select
        id="foodOption"
        v-model="foodOption"
        class="form-select shadow-none"
        @change="emit('update-food-price')"
      >
        <option value="">Select Food Preference (Optional)</option>

        <option v-for="option in foodOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="mb-4">
      <label for="food" class="form-label small text-secondary"> Monthly Food and Groceries Cost </label>

      <div class="input-group">
        <span class="input-group-text bg-light text-navy fw-semibold small">{{ currencyCode }}</span>

        <input
          id="food"
          data-testid="budget-food-input"
          v-model.number="food"
          type="number"
          class="form-control shadow-none"
          min="0"
          step="0.01"
          required
        />
      </div>
    </div>

    <!-- Transport -->
    <div class="mb-3">
      <label for="transportOption" class="form-label fw-semibold small text-navy">
        Transport Method
        <span class="optional-label ms-1">(Optional)</span>
      </label>

      <select
        id="transportOption"
        v-model="transportOption"
        class="form-select shadow-none"
        @change="emit('update-transport-price')"
      >
        <option value="">Select Transport (Optional)</option>

        <option v-for="option in transportOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="mb-4">
      <label for="transport" class="form-label small text-secondary"> Monthly Transport Cost </label>

      <div class="input-group">
        <span class="input-group-text bg-light text-navy fw-semibold small">{{ currencyCode }}</span>

        <input
          id="transport"
          data-testid="budget-transport-input"
          v-model.number="transport"
          type="number"
          class="form-control shadow-none"
          min="0"
          step="0.01"
          required
        />
      </div>
    </div>

    <!-- Personal & Other -->
    <div class="mb-3">
      <label for="personalExpenses" class="form-label small text-secondary"> Personal Expenses </label>

      <div class="input-group">
        <span class="input-group-text bg-light text-navy fw-semibold small">{{ currencyCode }}</span>

        <input
          id="personalExpenses"
          data-testid="budget-personal-input"
          v-model.number="personalExpenses"
          type="number"
          class="form-control shadow-none"
          min="0"
          step="0.01"
          required
        />
      </div>
    </div>

    <div class="mb-4">
      <label for="otherExpenses" class="form-label small text-secondary"> Other Expenses </label>

      <div class="input-group">
        <span class="input-group-text bg-light text-navy fw-semibold small">{{ currencyCode }}</span>

        <input
          id="otherExpenses"
          data-testid="budget-other-input"
          v-model.number="otherExpenses"
          type="number"
          class="form-control shadow-none"
          min="0"
          step="0.01"
          required
        />
      </div>
    </div>

    <!-- Total Box -->
    <div class="form-total rounded-3 p-3 mb-4 border">
      <div class="d-flex justify-content-between align-items-center gap-3 mb-2">
        <span class="text-secondary small">Monthly total</span>
        <strong class="text-navy">{{ formatMoney(monthlyBudget) }}</strong>
      </div>

      <div class="d-flex justify-content-between align-items-center gap-3 border-top pt-2">
        <span class="fw-semibold text-navy">Total for exchange</span>
        <strong class="fs-5 text-primary text-end">
          {{ formatMoney(totalExchangeBudget) }}
        </strong>
      </div>

      <div
        v-if="totalBudgetSGD !== null && currencyCode !== 'SGD'"
        class="d-flex justify-content-between align-items-center gap-3 mt-2 pt-2 border-top border-light"
      >
        <span class="small text-muted"> Approximate total in SGD </span>
        <strong class="small text-navy">
          {{ formatMoney(totalBudgetSGD, 'SGD') }}
        </strong>
      </div>
    </div>

    <button
      type="submit"
      class="btn btn-primary rounded-pill py-2.5 w-100 fw-semibold"
      data-testid="budget-submit-button"
      :disabled="saving || !validBudget"
    >
      <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      {{ saving ? 'Saving Budget...' : editingBudgetId ? 'Update Budget' : 'Create Budget' }}
    </button>

    <p class="small text-muted text-center mt-3 mb-0 fs-8">
      Choose a destination university before saving. Period and lifestyle choices can remain blank.
    </p>
  </form>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.optional-label {
  font-size: 0.75rem;
  font-weight: 400;
  color: #6c757d;
}

.period-details,
.form-total {
  background: var(--app-surface);
  border-color: var(--app-border) !important;
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

.fs-8 {
  font-size: 0.75rem;
}
</style>