<script setup>
defineProps({
  selectedUniversity: { type: Object, default: null },
  selectedUniversityId: { type: [String, Number], default: '' },
  durationMonths: { type: [String, Number], default: 1 },
  totalExchangeBudget: { type: Number, default: 0 },
  monthlyBudget: { type: Number, default: 0 },
  totalBudgetSGD: { type: Number, default: null },
  rateLoading: { type: Boolean, default: false },
  currencyCode: { type: String, default: 'SGD' },
  exchangeRate: { type: Number, default: 1 },
  publishedCost: { type: Object, default: null },
  publishedMonthlyCost: { type: Number, default: null },
  publishedTotalCost: { type: Number, default: null },
  publishedTotalSGD: { type: Number, default: null },
  remainingBudget: { type: Number, default: null },
  budgetStatus: { type: String, default: '' },
  formatMoney: { type: Function, required: true },
})
const emit = defineEmits(['use-published-estimates'])
</script>

<template>
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
                    @click="emit('use-published-estimates')"
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
</template>

<style scoped>
.summary-column { position: sticky; top: 1.5rem; }
.comparison-below { background: #e8f6ee; color: #17663a; }
.comparison-above { background: #fff0ed; color: #a32e20; }
.comparison-equal { background: #edf2ff; color: #2448a5; }

@media (max-width: 991.98px) {
  .summary-column { position: static; }
}

@media (max-width: 575.98px) {
  .card-body { padding: 1.25rem !important; }
}
</style>
