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
  <div class="info-panel-card card border-0" data-testid="info-panel">

    <div
      v-if="!university"
      class="empty-info-state d-flex flex-column align-items-center justify-content-center text-center p-4 h-100"
      data-testid="info-empty">
      <div class="empty-icon-wrapper mb-3">
        <i class="bi bi-geo-alt-fill text-primary display-6"></i>
      </div>
      <h3 class="h6 fw-bold mb-1">Select a University</h3>
      <p class="text-muted small mb-0 max-w-xs">
        Click a map pin or pick a university from the region list to preview details.
      </p>
    </div>

    <div v-else class="card-body d-flex flex-column h-100 p-3 p-md-4">

      <div class="info-header pb-3 mb-3 border-bottom">
        <div class="info-logo-box mb-2 mb-sm-0">
          <img
            v-if="logoUrl"
            :key="logoUrl"
            :src="logoUrl"
            :alt="`${university.name} logo`"
            class="info-logo"/>
          <i v-else
            class="bi bi-mortarboard fs-3 text-muted"
            aria-hidden="true"></i>
        </div>

        <div class="info-text">
          <h2 class="h6 fw-bold text-navy mb-1 text-wrap" data-testid="info-name">
            {{ university.name }}
          </h2>
          <div class="d-flex align-items-center gap-1 text-muted small">
            <span>{{ university.city }}, {{ university.country }}</span>
          </div>
          <span v-if="university.region" class="badge region-tag mt-2">
            {{ university.region }}
          </span>
        </div>
      </div>

      <div class="info-content-body flex-grow-1 d-flex flex-column gap-3">

        <div class="cost-stat-card p-3 rounded-3">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <span class="text-uppercase fw-bold text-secondary fs-8">Est. Monthly Cost</span>
            <i class="bi bi-wallet2 text-primary"></i>
          </div>
          <div class="fw-bold fs-5 text-navy">
            {{ estimatedMonthlyCost }}
          </div>
          <p class="text-muted fs-8 mb-0 mt-1">
            Converted to SGD using live FX rates.
          </p>
        </div>
      </div>

      <div class="pt-3 mt-auto border-top">
        <RouterLink
          :to="`/universities/${university.id}`"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2 py-2"
          data-testid="info-details-link">
          <span>View University Details</span>
          <i class="bi bi-arrow-right"></i>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info-panel-card {
  height: var(--home-map-height, 480px);
  background: #ffffff;
  border: 1px solid var(--app-border) !important;
  border-radius: var(--app-radius);
  overflow: hidden;
}

.empty-icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.max-w-xs {
  max-width: 200px;
}

.text-navy {
  color: var(--app-navy);
}

.info-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 576px) {
  .info-header {
    flex-direction: row;
    align-items: flex-start;
  }
}

.info-logo-box {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-border);
  border-radius: 0.75rem;
  overflow: hidden;
  background-color: #ffffff;
}

.info-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.info-text {
  flex: 1;
  min-width: 0;
}

.region-tag {
  background-color: rgba(44, 51, 102, 0.08);
  color: var(--app-blue);
  font-size: 0.7rem;
  font-weight: 600;
}

.cost-stat-card {
  background-color: var(--app-surface);
  border: 1px solid var(--app-border);
}

.fs-7 {
  font-size: 0.825rem;
}

.fs-8 {
  font-size: 0.75rem;
}
</style>
