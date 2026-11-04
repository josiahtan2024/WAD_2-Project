<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useExchangeRatesStore } from '@/stores/exchangeRates'

const props = defineProps({ cost: { type: Object, default: null } })
const emit = defineEmits(['submit'])

const exchangeRates = useExchangeRatesStore()

const CURRENCY_LIST = ['USD', 'SGD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY', 'KRW', 'HKD', 'NZD', 'CHF', 'SEK', 'NOK', 'THB']

const AMOUNTS = [
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'food', label: 'Food' },
  { key: 'transport', label: 'Transport' },
  { key: 'personal_expenses', label: 'Personal Expenses' },
]

const form = reactive({
  currency_code: props.cost?.currency_code ?? '',
  ...Object.fromEntries(AMOUNTS.map((a) => [a.key, props.cost?.[a.key] ?? ''])),
})
const errors = ref({})

const availableCurrencies = computed(() => {
  const loadedRates = Object.keys(exchangeRates.rates)
  return loadedRates.length ? loadedRates.sort() : CURRENCY_LIST
})

const monthlySgd = computed(() => {
  const rate = exchangeRates.rates[form.currency_code.trim().toUpperCase()]
  const total = AMOUNTS.reduce((sum, a) => sum + (Number(form[a.key]) || 0), 0)
  if (!Number.isFinite(rate) || rate <= 0 || !total) return null
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', currencyDisplay: 'code', maximumFractionDigits: 0 }).format(total / rate)
})

function submit() {
  const found = {}
  const currency = form.currency_code.trim().toUpperCase()
  if (!currency) {
    found.currency_code = 'Select a currency.'
  } else if (exchangeRates.loaded && !exchangeRates.rates[currency]) {
    found.currency_code = `No exchange rate for ${currency}.`
  }

  const cost = { currency_code: currency }
  for (const { key, label } of AMOUNTS) {
    const text = String(form[key]).trim()
    if (text === '') {
      cost[key] = null
      continue
    }
    const number = Number(text)
    if (!Number.isFinite(number) || number < 0) {
      found[key] = `${label} must be zero or a positive number.`
    } else {
      cost[key] = number
    }
  }
  errors.value = found
  if (Object.keys(found).length === 0) emit('submit', cost)
}

onMounted(() => exchangeRates.load())
</script>

<template>
  <form id="admin-form" class="d-flex flex-column gap-3" novalidate @submit.prevent="submit">
    <div>
      <label class="form-label fw-semibold text-navy small mb-1" for="cost-currency">Currency</label>
      <select id="cost-currency" v-model="form.currency_code" class="form-select shadow-none" :class="{ 'is-invalid': errors.currency_code }" data-testid="admin-field-currency">
        <option value="" disabled>Select Currency</option>
        <option v-for="c in availableCurrencies" :key="c" :value="c">{{ c }}</option>
      </select>
      <div v-if="errors.currency_code" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.currency_code }}</div>
    </div>

    <div v-for="a in AMOUNTS" :key="a.key">
      <label class="form-label fw-semibold text-navy small mb-1" :for="`cost-${a.key}`">{{ a.label }}</label>
      <input
        :id="`cost-${a.key}`"
        v-model="form[a.key]"
        type="number"
        min="0"
        step="any"
        class="form-control shadow-none"
        inputmode="decimal"
        placeholder="0"
        :class="{ 'is-invalid': errors[a.key] }"
        :data-testid="`admin-field-${a.key}`"
      />
      <div v-if="errors[a.key]" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors[a.key] }}</div>
    </div>

    <div v-if="monthlySgd" class="p-3 bg-surface border rounded-3 text-navy small mt-1" data-testid="admin-cost-preview">
      Estimated Monthly Total: <strong class="text-primary">{{ monthlySgd }}</strong>
    </div>
  </form>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.bg-surface {
  background-color: var(--app-surface, #f8f9fc);
}
</style>