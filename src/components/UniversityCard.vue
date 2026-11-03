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
      : 'SGD estimate unavailable'
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
    class="card h-100 shadow-sm university-card border rounded-4 overflow-hidden bg-white d-flex flex-column"
    :class="{ 'is-hovered': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    data-testid="university-card"
  >
    <div class="card-body d-flex flex-column p-4">
      
      <!-- Top info block -->
      <div class="d-flex align-items-start gap-3 mb-3">
        <div
          v-if="university.logo_url"
          class="university-logo-box position-relative flex-shrink-0 rounded-3 overflow-hidden border bg-light p-1"
        >
          <img
            :src="getLogoUrl(university.logo_url)"
            :alt="`${university.name} logo`"
            class="university-logo"
            loading="lazy"
          />
        </div>

        <div class="university-info flex-grow-1 min-width-0">
          <span v-if="university.published === false" class="badge text-bg-secondary mb-2" data-testid="university-hidden-badge">Hidden from students</span>
          <h2
            class="h5 card-title university-name mb-1 text-truncate"
            data-testid="university-card-name"
          >
            {{ university.name }}
          </h2>

          <p class="card-text text-muted small mb-1">
            <i class="bi bi-geo-alt text-primary me-1"></i>{{ university.city }}, {{ university.country }}
          </p>

          <p class="small text-secondary fw-medium mb-0">
            Est. monthly: <span class="text-dark">{{ estimatedMonthlyCost }}</span>
          </p>
        </div>
      </div>

      <!-- Bottom action bar -->
      <div class="mt-auto pt-3 border-top d-flex align-items-center justify-content-between gap-2 flex-wrap">
        <div class="d-flex flex-wrap gap-2">
          <RouterLink
            :to="`/universities/${university.id}`"
            class="btn btn-outline-primary btn-sm rounded-pill px-3"
            data-testid="university-card-link"
          >
            Details
          </RouterLink>

          <RouterLink
            v-if="auth.adminActive"
            :to="{ path: `/universities/${university.id}`, query: { edit: 'details' } }"
            class="btn btn-outline-secondary btn-sm rounded-pill px-3"
            data-testid="university-card-edit"
          >
            Edit
          </RouterLink>

          <button
            class="btn btn-sm rounded-pill px-3"
            :class="shortlisted ? 'btn-secondary' : 'btn-primary'"
            :data-testid="shortlisted ? 'shortlist-remove-btn' : 'shortlist-add-btn'"
            @click="$emit('toggle-shortlist', university)"
          >
            {{ shortlisted ? 'Remove' : 'Shortlist' }}
          </button>
        </div>

        <span class="university-region small text-muted ms-auto"
          :class="{ 'is-filtered': selectedRegion === university.region }">
          {{ university.region }}
        </span>
      </div>

    </div>
  </div>
</template>

<style scoped>
.university-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.university-card.is-hovered {
  transform: translateY(-3px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08) !important;
  border-color: rgba(44, 51, 102, 0.2) !important;
}

.university-name {
  font-weight: 700;
  color: var(--app-navy, #0b2348);
}

.university-info {
  min-width: 0;
  overflow-wrap: anywhere;
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

.university-region {
  font-weight: 400;
}

.university-region.is-filtered {
  color: var(--app-navy, #0b2348) !important;
  font-weight: 700;
}
</style>