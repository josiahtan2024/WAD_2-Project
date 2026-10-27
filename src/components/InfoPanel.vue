<script setup>
import { computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { calculateMonthlyCost } from '@/lib/universityCost'
import { useExchangeRatesStore } from '@/stores/exchangeRates'

const props = defineProps({
  university: { type: Object, default: null },
})

const logoUrl = computed(() => {
  const path = props.university?.logo_url
  if (!path) return ''

  if (/^https?:\/\//i.test(path)) return path

  const filePath = path.replace(/^\/?university-logos\//, '')

  return supabase.storage
    .from('university-logos')
    .getPublicUrl(filePath).data.publicUrl
})



const exchangeRates = useExchangeRatesStore()

const estimatedMonthlyCost = computed(() => {
  const cost = props.university?.university_costs
  const total = calculateMonthlyCost(cost)
  const currency = cost?.currency_code?.trim().toUpperCase()

  if (total === null || !Number.isFinite(total) || !currency) {
    return 'Not available'
  }

  const rate = exchangeRates.rates[currency]

  if (!Number.isFinite(rate) || rate <= 0) {
    return exchangeRates.loading
      ? 'Loading...'
      : 'SGD estimate unavailable'
  }

  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(total / rate)
})
</script>

<template>
  <div class="card card-body" data-testid="info-panel">
    <p
      v-if="!university"
      class="text-muted mb-0"
      data-testid="info-empty"
    >
      Click a pin to see details.
    </p>

    <template v-else>
      <div class="info-header mb-3">
        <div class="info-logo-box">
        <img
          v-if="logoUrl"
          :key="logoUrl"
          :src="logoUrl"
          :alt="`${university.name} logo`"
          class="info-logo"/>
          <i
          v-else
          class="bi bi-mortarboard fs-3 text-muted"
          aria-hidden="true"></i>
        </div>

        <div class="info-text">
          <h2 class="h5 mb-2" data-testid="info-name">{{ university.name }}</h2>
          <p class="text-muted mb-0">{{ university.city }}, {{ university.country }}</p>
        </div>
      </div>

      <p class="mb-3">
        Estimated monthly cost: {{ estimatedMonthlyCost }}
      </p>

      <RouterLink
        :to="`/universities/${university.id}`"
        class="btn btn-primary btn-sm"
        data-testid="info-details-link"
      >
        View details
      </RouterLink>
    </template>
  </div>
</template>

<style scoped>
.info-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  color:rgb(1, 1, 110)
}

.info-logo-box {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  border: 1px solid var(--bs-border-color);
  border-radius: 12px;
  overflow: hidden;
  background-color: white;
}

.info-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.info-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>