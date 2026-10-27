<script setup>
defineProps({
  budget: { type: Object, default: null },
  formatMoney: { type: Function, required: true },
})

const emit = defineEmits(['close'])
const expenses = [
  { label: 'Accommodation', key: 'accommodation_budget' },
  { label: 'Food', key: 'food_budget' },
  { label: 'Transport', key: 'transport_budget' },
  { label: 'Personal expenses', key: 'personal_budget' },
  { label: 'Other expenses', key: 'other_budget' },
]

function formatPreference(value) {
  return value
    ? value.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'Not specified'
}
</script>

<template>
  <Transition name="budget-details">
    <div v-if="budget" class="details-backdrop" role="presentation" @click.self="emit('close')">
      <section class="details-card card border-0 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="budget-details-title">
        <div class="card-header bg-white border-0 d-flex justify-content-between gap-3 p-4 pb-2">
          <div>
            <p class="text-secondary small mb-1">Saved exchange budget</p>
            <h2 id="budget-details-title" class="h4 fw-bold mb-0">{{ budget.university_name }}</h2>
            <p class="text-secondary mb-0">{{ budget.university_country }}</p>
          </div>
          <button type="button" class="btn-close" aria-label="Close budget details" @click="emit('close')"></button>
        </div>

        <div class="card-body px-4 pt-2">
          <div class="summary rounded-3 p-3 mb-4">
            <div class="d-flex justify-content-between gap-3 mb-2"><span class="text-secondary">Exchange period</span><strong class="text-end">{{ budget.period_name || 'Not specified' }}</strong></div>
            <div class="d-flex justify-content-between gap-3 mb-2"><span class="text-secondary">Duration</span><strong>{{ budget.duration_months }} month<span v-if="Number(budget.duration_months) !== 1">s</span></strong></div>
            <div class="d-flex justify-content-between gap-3"><span class="text-secondary">Total budget</span><strong class="text-primary">{{ formatMoney(budget.total_budget, budget.currency_code || 'SGD') }}</strong></div>
          </div>

          <h3 class="h6 fw-bold mb-3">Monthly expenses</h3>
          <div v-for="expense in expenses" :key="expense.key" class="d-flex justify-content-between gap-3 mb-3">
            <span class="text-secondary">{{ expense.label }}</span>
            <strong>{{ formatMoney(budget[expense.key], budget.currency_code || 'SGD') }}</strong>
          </div>

          <div class="border-top pt-3 mt-4">
            <h3 class="h6 fw-bold mb-3">Preferences</h3>
            <div class="d-flex justify-content-between gap-3 mb-2"><span class="text-secondary">Accommodation</span><strong>{{ formatPreference(budget.housing_type) }}</strong></div>
            <div class="d-flex justify-content-between gap-3 mb-2"><span class="text-secondary">Food</span><strong>{{ formatPreference(budget.food_option) }}</strong></div>
            <div class="d-flex justify-content-between gap-3"><span class="text-secondary">Transport</span><strong>{{ formatPreference(budget.transport_option) }}</strong></div>
          </div>
        </div>

        <div class="card-footer bg-white border-0 d-flex justify-content-end p-4 pt-2">
          <button type="button" class="btn btn-secondary" @click="emit('close')">Close</button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
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

.details-card { width: min(100%, 34rem); max-height: calc(100vh - 2rem); overflow-y: auto; border-radius: 1rem; }
.summary { background: #f7f8fc; border: 1px solid #e8eaf0; }
.budget-details-enter-active, .budget-details-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.budget-details-enter-from, .budget-details-leave-to { opacity: 0; transform: translateY(0.5rem) scale(0.98); }
</style>
