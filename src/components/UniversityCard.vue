<script setup>
import { ref, computed } from 'vue'
import { useExchangeRatesStore } from '@/stores/exchangeRates'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { calculateMonthlyCost } from '@/lib/universityCost'

const exchangeRates = useExchangeRatesStore()
const auth = useAuthStore()
const isHovered = ref(false)

const props = defineProps({
  university: { type: Object, required: true },
  shortlisted: { type: Boolean, default: false },
  selectedRegion: { type: String, default: null },
})

defineEmits(['toggle-shortlist'])

function getLogoUrl(path) {
  if (!path) return ''
  const filePath = path.replace(/^university-logos\//, '')
  return supabase.storage
    .from('university-logos')
    .getPublicUrl(filePath).data.publicUrl
}

const estimatedMonthlyCost = computed(() => {
  const cost = props.university.university_costs
  const total = calculateMonthlyCost(cost)
  const currency = cost?.currency_code?.trim().toUpperCase()

  if (total === null || !Number.isFinite(total) || !currency) {
    return 'Not available'
  }

  const rate = exchangeRates.rates[currency]

  if (!Number.isFinite(rate) || rate <= 0) {
    return exchangeRates.loading
      ? 'Loading...'
      : 'Not available'
  }

  const totalSGD = total / rate

  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(totalSGD)
})
</script>

<template>
  <div
    class="card h-100 university-card border rounded-4 overflow-hidden bg-white d-flex flex-column"
    :class="{ 'is-hovered': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    data-testid="university-card"
  >
    <div class="card-body d-flex flex-column p-4">
      
      <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div
          v-if="university.logo_url"
          class="university-logo-box position-relative flex-shrink-0 rounded-3 overflow-hidden border bg-light"
        >
          <img
            :src="getLogoUrl(university.logo_url)"
            :alt="`${university.name} logo`"
            class="university-logo"
            loading="lazy"
          />
        </div>
        <div v-else class="university-logo-box d-flex align-items-center justify-content-center rounded-3 border bg-light">
          <i class="bi bi-mortarboard fs-4 text-muted"></i>
        </div>

        <div class="d-flex align-items-center gap-2">
          <span
            v-if="university.published === false"
            class="badge bg-secondary rounded-pill p-2 d-flex align-items-center justify-content-center"
            title="Hidden from students"
            data-testid="university-hidden-badge">
            <i class="bi bi-eye-slash"></i>
          </span>

          <span class="badge region-badge rounded-pill px-3 py-2 fw-semibold bg-light text-navy border">
            <i class="bi bi-geo-alt-fill me-1"></i>{{ university.region }}
          </span>
        </div>
      </div>

      <div class="mb-4 flex-grow-1 min-width-0">
        <h2
          class="h5 card-title university-name mb-1 text-truncate"
          :title="university.name"
          data-testid="university-card-name"
        >
          {{ university.name }}
        </h2>

        <p class="card-text text-muted small mb-3">
          {{ university.city }}, {{ university.country }}
        </p>

        <div class="cost-stat-card p-3 rounded-3 border bg-light d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-wallet2 text-primary fs-7"></i>
            <span class="text-secondary fw-medium small">Est. Monthly Cost</span>
          </div>
          <span class="fw-bold text-navy small">{{ estimatedMonthlyCost }}</span>
        </div>
      </div>

      <div class="mt-auto pt-4 border-top d-flex gap-2 flex-wrap flex-sm-nowrap">
        <RouterLink
          :to="`/universities/${university.id}`"
          class="btn btn-primary btn-sm flex-fill rounded-pill py-2"
          data-testid="university-card-link"
        >
          Details
        </RouterLink>

        <RouterLink
          v-if="auth.adminActive"
          :to="{ path: `/universities/${university.id}`, query: { edit: 'details' } }"
          class="btn btn-outline-secondary btn-sm rounded-pill py-2 px-3"
          data-testid="university-card-edit"
        >
          Edit
        </RouterLink>

        <button
          class="btn btn-sm flex-fill rounded-pill py-2"
          :class="shortlisted ? 'btn-primary' : 'btn-outline-primary'"
          :data-testid="shortlisted ? 'shortlist-remove-btn' : 'shortlist-add-btn'"
          @click="$emit('toggle-shortlist', university)"
        >
          <i class="bi me-1" :class="shortlisted ? 'bi-bookmark-fill' : 'bi-bookmark-plus'"></i>
          {{ shortlisted ? 'Shortlisted' : 'Shortlist' }}
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.university-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.university-card.is-hovered {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.05) !important;
  border-color: rgba(44, 51, 102, 0.2) !important;
}

.university-name {
  font-weight: 700;
  color: var(--app-navy, #0b2348);
}

.university-logo-box {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.university-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.region-badge {
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  background-color: var(--app-surface) !important;
  border-color: var(--app-border) !important;
}

.cost-stat-card {
  background-color: var(--app-surface) !important;
  border-color: var(--app-border) !important;
}
</style>