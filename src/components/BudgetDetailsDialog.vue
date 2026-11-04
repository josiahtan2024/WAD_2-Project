<script setup>
import { watch, onUnmounted } from 'vue'

const props = defineProps({
  budget: { type: Object, default: null },
  formatMoney: { type: Function, required: true },
})

const emit = defineEmits(['close'])

// Scroll lock watch hook
watch(
  () => props.budget,
  (newVal) => {
    if (newVal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true }
)

// Clean up scroll lock if component unmounts unexpectedly
onUnmounted(() => {
  document.body.style.overflow = ''
})

const expenses = [
  { label: 'Accommodation', key: 'accommodation_budget' },
  { label: 'Food', key: 'food_budget' },
  { label: 'Transport', key: 'transport_budget' },
  { label: 'Personal expenses', key: 'personal_budget' },
  { label: 'Other expenses', key: 'other_budget' },
]

function formatPreference(value) {
  return value
    ? value
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Not specified'
}
</script>

<template>
  <Transition name="budget-details">
    <div v-if="budget" class="details-backdrop" role="presentation" @click.self="emit('close')">
      <section
        class="details-card budget-details-scroll card border-0 shadow-lg rounded-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-details-title"
        data-testid="budget-details-dialog"
      >
        <div class="card-header bg-white border-bottom d-flex justify-content-between align-items-start gap-3 p-4">
          <div>
            <p class="text-muted small mb-1 fw-semibold text-uppercase tracking-wider fs-9">Saved Exchange Budget</p>
            <h2 id="budget-details-title" class="h4 fw-bold text-navy mb-1">{{ budget.university_name }}</h2>
            <p class="text-muted small mb-0">
              <i class="bi bi-geo-alt text-primary me-1"></i>{{ budget.university_country }}
            </p>
          </div>
          <button
            type="button"
            class="btn-close shadow-none"
            aria-label="Close budget details"
            @click="emit('close')"
          ></button>
        </div>

        <div class="card-body p-4">
          <div class="summary-box rounded-3 p-3 mb-4">
            <div class="d-flex justify-content-between align-items-center gap-3 mb-2">
              <span class="text-muted small">Exchange Period</span>
              <strong class="text-end text-navy small">{{ budget.period_name || 'Not specified' }}</strong>
            </div>
            <div class="d-flex justify-content-between align-items-center gap-3 mb-2">
              <span class="text-muted small">Duration</span>
              <strong class="text-navy small"
                >{{ budget.duration_months }} month<span v-if="Number(budget.duration_months) !== 1"
                  >s</span
                ></strong
              >
            </div>
            <div class="d-flex justify-content-between align-items-center gap-3 pt-2 border-top">
              <span class="text-muted small fw-semibold">Total Budget</span>
              <strong class="text-primary fs-6">{{
                formatMoney(budget.total_budget, budget.currency_code || 'SGD')
              }}</strong>
            </div>
          </div>

          <h3 class="h6 fw-bold text-navy mb-3">Monthly Expenses</h3>
          <div class="mb-4">
            <div
              v-for="expense in expenses"
              :key="expense.key"
              class="d-flex justify-content-between align-items-center gap-3 py-2 border-bottom border-light"
            >
              <span class="text-secondary small">{{ expense.label }}</span>
              <strong class="text-navy small">{{ formatMoney(budget[expense.key], budget.currency_code || 'SGD') }}</strong>
            </div>
          </div>

          <div class="pt-2">
            <h3 class="h6 fw-bold text-navy mb-3">Preferences</h3>
            <div class="d-flex justify-content-between align-items-center gap-3 mb-2">
              <span class="text-muted small">Accommodation</span>
              <strong class="text-navy small">{{ formatPreference(budget.housing_type) }}</strong>
            </div>
            <div class="d-flex justify-content-between align-items-center gap-3 mb-2">
              <span class="text-muted small">Food</span>
              <strong class="text-navy small">{{ formatPreference(budget.food_option) }}</strong>
            </div>
            <div class="d-flex justify-content-between align-items-center gap-3">
              <span class="text-muted small">Transport</span>
              <strong class="text-navy small">{{ formatPreference(budget.transport_option) }}</strong>
            </div>
          </div>
        </div>

        <div class="card-footer bg-light border-top d-flex justify-content-end p-3 px-4">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary rounded-pill px-4"
            data-testid="budget-details-close"
            @click="emit('close')"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.details-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1090;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 1rem;
  background: rgba(25, 30, 40, 0.45);
  backdrop-filter: blur(2px);
}

.details-card {
  width: min(100%, 34rem);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  background-color: #ffffff;
}

.budget-details-scroll {
  overscroll-behavior: contain;
}

.budget-details-scroll::-webkit-scrollbar {
  width: 5px;
}

.budget-details-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.budget-details-scroll::-webkit-scrollbar-thumb {
  background: rgba(20, 27, 77, 0.15);
  border-radius: 4px;
}

.summary-box {
  background-color: var(--app-surface, #f8f9fc);
  border: 1px solid var(--app-border, #e8eaf0);
}

.fs-9 {
  font-size: 0.6875rem;
}

.tracking-wider {
  letter-spacing: 0.05em;
}

.budget-details-enter-active,
.budget-details-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.budget-details-enter-from,
.budget-details-leave-to {
  opacity: 0;
  transform: translateY(0.5rem) scale(0.98);
}
</style>
