<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useExchangeRatesStore } from '@/stores/exchangeRates'

const props = defineProps({ cost: { type: Object, default: null } })
const emit = defineEmits(['submit'])

const exchangeRates = useExchangeRatesStore()
const AMOUNTS = [
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'food', label: 'Food' },
  { key: 'transport', label: 'Transport' },
  { key: 'personal_expenses', label: 'Personal expenses' },
]

const form = reactive({
  currency_code: props.cost?.currency_code ?? '',
  ...Object.fromEntries(AMOUNTS.map((a) => [a.key, props.cost?.[a.key] ?? ''])),
})
const errors = ref({})

const currencies = computed(() => Object.keys(exchangeRates.rates).sort())

// same sum the rest of the app shows as "estimated monthly cost"
const monthlySgd = computed(() => {
  const rate = exchangeRates.rates[form.currency_code.trim().toUpperCase()]
  const total = AMOUNTS.reduce((sum, a) => sum + (Number(form[a.key]) || 0), 0)
  if (!Number.isFinite(rate) || rate <= 0 || !total) return null
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', currencyDisplay: 'code', maximumFractionDigits: 0 }).format(total / rate)
})

function submit() {
  const found = {}
  const currency = form.currency_code.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) found.currency_code = 'Use a three letter currency code, for example EUR.'
  else if (exchangeRates.loaded && !exchangeRates.rates[currency]) found.currency_code = `There is no exchange rate for ${currency}, so students would not see an SGD estimate.`

  const cost = { currency_code: currency }
  for (const { key, label } of AMOUNTS) {
    const text = String(form[key]).trim()
    const number = Number(text)
    if (text !== '' && (!Number.isFinite(number) || number < 0)) found[key] = `${label} must be zero or more.`
    cost[key] = text === '' ? null : number
  }
  errors.value = found
  if (Object.keys(found).length === 0) emit('submit', cost)
}

onMounted(() => exchangeRates.load())
</script>

<template>
  <form id="admin-form" novalidate @submit.prevent="submit">
    <p class="text-secondary small">Monthly costs in the local currency.</p>
    <div class="mb-3">
      <label class="form-label" for="cost-currency">Currency</label>
      <input id="cost-currency" v-model="form.currency_code" class="form-control text-uppercase" list="cost-currencies" maxlength="3" :class="{ 'is-invalid': errors.currency_code }" data-testid="admin-field-currency" />
      <datalist id="cost-currencies"><option v-for="c in currencies" :key="c" :value="c" /></datalist>
      <div v-if="errors.currency_code" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.currency_code }}</div>
    </div>
    <div v-for="a in AMOUNTS" :key="a.key" class="mb-3">
      <label class="form-label" :for="`cost-${a.key}`">{{ a.label }}</label>
      <input :id="`cost-${a.key}`" v-model="form[a.key]" class="form-control" inputmode="decimal" :class="{ 'is-invalid': errors[a.key] }" :data-testid="`admin-field-${a.key}`" />
      <div v-if="errors[a.key]" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors[a.key] }}</div>
    </div>
    <p v-if="monthlySgd" class="mb-0" data-testid="admin-cost-preview">Students will see about <strong>{{ monthlySgd }}</strong> a month.</p>
  </form>
</template>
