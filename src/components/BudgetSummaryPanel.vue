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
      <!-- Main Budget Result -->
      <div class="card border rounded-4 shadow-sm mb-4 bg-white overflow-hidden">
        <div class="card-body p-4">
          <p class="text-muted small mb-1 fw-semibold text-uppercase tracking-wider fs-9">Estimated Exchange Budget</p>

          <h2 class="display-6 fw-bold text-navy mb-1" data-testid="budget-total">
            {{ formatMoney(totalExchangeBudget) }}
          </h2>

          <p class="text-muted small mb-3">
            For {{ durationMonths }} Month<span v-if="Number(durationMonths) !== 1">s</span>
          </p>

          <div class="pt-3 border-top">
            <div class="d-flex justify-content-between gap-3 mb-2">
              <span class="text-secondary small">Monthly Budget</span>
              <strong class="text-navy small">{{ formatMoney(monthlyBudget) }}</strong>
            </div>

            <div class="d-flex justify-content-between gap-3 mb-2">
              <span class="text-secondary small">Exchange Duration</span>
              <strong class="text-navy small">
                {{ durationMonths }} month<span v-if="Number(durationMonths) !== 1">s</span>
              </strong>
            </div>

            <div class="d-flex justify-content-between gap-3 pt-2 border-top">
              <span class="text-secondary small fw-semibold">Estimated in SGD</span>
              <strong class="text-primary small">
                {{ totalBudgetSGD === null ? 'Not available' : formatMoney(totalBudgetSGD, 'SGD') }}
              </strong>
            </div>
          </div>

          <p v-if="rateLoading" class="small text-muted mt-3 mb-0 fs-8">
            <span class="spinner-border spinner-border-sm me-1 text-primary"></span>
            Updating currency conversion...
          </p>

          <p
            v-else-if="currencyCode !== 'SGD' && exchangeRate === 1"
            class="small text-warning mt-3 mb-0 fs-8"
          >
            <i class="bi bi-exclamation-triangle me-1"></i>
            SGD conversion may be unavailable. Check exchange rates directly.
          </p>

          <p v-else-if="currencyCode !== 'SGD'" class="small text-muted mt-3 mb-0 fs-8">
            Indicative conversion using the latest Frankfurter rate. Bank rates may vary.
          </p>
        </div>
      </div>

      <!-- Published Costs -->
      <div class="card border rounded-4 shadow-sm mb-4 bg-white">
        <div class="card-body p-4">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
            <div>
              <h2 class="h6 fw-bold text-navy mb-1">Published Cost Estimates</h2>
              <p class="small text-muted mb-0">
                {{ selectedUniversity?.name || 'Select a university to view costs' }}
              </p>
            </div>
            <span class="badge bg-light text-navy border rounded-pill px-2.5 py-1 fs-9 fw-semibold">
              Published
            </span>
          </div>

          <div v-if="!selectedUniversityId" class="text-center py-4 text-muted bg-light rounded-3 border border-dashed">
            <i class="bi bi-building fs-3 mb-1 d-block text-secondary"></i>
            <p class="small mb-0">Choose a destination university to view published estimates.</p>
          </div>

          <div v-else-if="!publishedCost" class="text-center py-4 text-muted bg-light rounded-3 border border-dashed">
            <i class="bi bi-slash-circle fs-3 mb-1 d-block text-secondary"></i>
            <p class="small mb-0">No published cost estimate available for this university.</p>
          </div>

          <div v-else>
            <div class="py-2">
              <div
                v-for="item in [
                  { label: 'Accommodation', value: publishedCost.accommodation },
                  { label: 'Food', value: publishedCost.food },
                  { label: 'Transport', value: publishedCost.transport },
                  { label: 'Personal Expenses', value: publishedCost.personal_expenses },
                  { label: 'Other Expenses', value: publishedCost.other_expenses },
                ]"
                :key="item.label"
                class="d-flex justify-content-between gap-3 mb-2"
              >
                <span class="text-muted small">{{ item.label }}</span>
                <span class="fw-semibold text-end text-navy small">
                  {{ item.value === null || item.value === undefined ? '—' : formatMoney(item.value) }}
                </span>
              </div>
            </div>

            <div class="pt-3 border-top mt-2">
              <div class="d-flex justify-content-between gap-3 mb-2">
                <span class="fw-semibold small text-navy">Estimated Monthly Total</span>
                <strong class="small text-navy">
                  {{ publishedMonthlyCost === null ? 'Not available' : formatMoney(publishedMonthlyCost) }}
                </strong>
              </div>

              <div class="d-flex justify-content-between gap-3 mb-2">
                <span class="fw-semibold small text-navy">Estimated Total for Period</span>
                <strong class="text-primary text-end">
                  {{ publishedTotalCost === null ? 'Not available' : formatMoney(publishedTotalCost) }}
                </strong>
              </div>

              <div
                v-if="publishedTotalSGD !== null && currencyCode !== 'SGD'"
                class="d-flex justify-content-between gap-3 pt-2 border-top"
              >
                <span class="small text-muted fs-8">Approximate SGD Total</span>
                <span class="small fw-semibold text-navy fs-8">
                  {{ formatMoney(publishedTotalSGD, 'SGD') }}
                </span>
              </div>
            </div>

            <button
              type="button"
              class="btn btn-outline-primary btn-sm rounded-pill w-100 mt-4 py-2"
              @click="emit('use-published-estimates')"
            >
              Use Published Estimates
            </button>

            <p class="small text-muted mt-2 mb-0 fs-8 text-center">
              Copies published numbers directly into your editable budget.
            </p>
          </div>
        </div>
      </div>

      <!-- Comparison -->
      <div v-if="publishedTotalCost !== null" class="card border rounded-4 shadow-sm bg-white">
        <div class="card-body p-4">
          <h2 class="h6 fw-bold text-navy mb-3">Budget Comparison</h2>

          <div class="d-flex justify-content-between gap-3 mb-2">
            <span class="text-muted small">Your Budget</span>
            <strong class="text-end text-navy small">
              {{ formatMoney(totalExchangeBudget) }}
            </strong>
          </div>

          <div class="d-flex justify-content-between gap-3 mb-3">
            <span class="text-muted small">Published Estimate</span>
            <strong class="text-end text-navy small">
              {{ formatMoney(publishedTotalCost) }}
            </strong>
          </div>

          <div
            class="rounded-3 p-3 border"
            :class="{
              'comparison-below': budgetStatus === 'below',
              'comparison-above': budgetStatus === 'above',
              'comparison-equal': budgetStatus === 'equal',
            }"
          >
            <p class="small mb-1 font-medium">
              {{
                budgetStatus === 'below'
                  ? 'Your budget is below the published estimate by'
                  : budgetStatus === 'above'
                    ? 'Your budget is above the published estimate by'
                    : 'Your budget matches the published estimate'
              }}
            </p>

            <strong class="fs-6">
              {{ formatMoney(Math.abs(remainingBudget)) }}
            </strong>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.summary-column {
  position: sticky;
  top: 5rem;
}

.fs-8 {
  font-size: 0.75rem;
}

.fs-9 {
  font-size: 0.6875rem;
}

.tracking-wider {
  letter-spacing: 0.05em;
}

.border-dashed {
  border-style: dashed !important;
}

.comparison-below {
  background: #e8f6ee;
  color: #17663a;
  border-color: #c2e9d2 !important;
}

.comparison-above {
  background: #fff0ed;
  color: #a32e20;
  border-color: #f7ceca !important;
}

.comparison-equal {
  background: #edf2ff;
  color: #2448a5;
  border-color: #cfdbfe !important;
}

@media (max-width: 991.98px) {
  .summary-column {
    position: static;
  }
}
</style>