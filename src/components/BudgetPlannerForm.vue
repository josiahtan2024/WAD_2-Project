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
const selectedUniversityId = defineModel('selectedUniversityId', { type: [String, Number], default: '' })
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
const emit = defineEmits(['submit', 'update-accommodation-price', 'update-food-price', 'update-transport-price'])
</script>

<template>
<form @submit.prevent="emit('submit')">
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
                    @change="emit('update-accommodation-price')"
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
                    @change="emit('update-food-price')"
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
                    @change="emit('update-transport-price')"
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

                  {{ saving ? 'Saving budget...' : (editingBudgetId ? 'Update Budget' : 'Create Budget') }}
                </button>

                <p class="small text-secondary text-center mt-3 mb-0">
                  Choose a destination university before saving. Exchange
                  period and lifestyle preferences can remain blank.
                </p>
              </form>
</template>

<style scoped>
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

.form-control,
.form-select,
.input-group-text { min-width: 0; }

.form-select:disabled {
  background-color: #f5f6f8;
  cursor: not-allowed;
}

@media (max-width: 575.98px) {
  .card-body { padding: 1.25rem !important; }

  .input-group-lg > .form-control,
  .input-group-lg > .input-group-text { font-size: 1rem; }
}
</style>
