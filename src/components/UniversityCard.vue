<script setup>
import { useExchangeRatesStore } from '@/stores/exchangeRates'
import { useAuthStore } from '@/stores/auth'
const exchangeRates = useExchangeRatesStore()
const auth = useAuthStore()
import { supabase } from '@/lib/supabase'
function getLogoUrl(path) {
  const filePath = path.replace(/^university-logos\//, '')

  return supabase.storage
    .from('university-logos')
    .getPublicUrl(filePath).data.publicUrl
}
import { ref, computed } from 'vue'
import { calculateMonthlyCost } from '@/lib/universityCost'
const isHovered = ref(false)

const props = defineProps({
  university: { type: Object, required: true },
  shortlisted: { type: Boolean, default: false },
  selectedRegion: { type: String, default: null },
})

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
defineEmits(['toggle-shortlist'])
</script>

<style scoped>
.university-card {
  outline: 2px solid transparent;
  outline-offset: 0;
  transition: outline-color 0.15s ease;
}

.university-card.is-hovered {
  outline-color: var(--bs-primary);
}

.university-name{
  font-weight:800;
  color: #01125f;
}
.university-info {
  min-width: 0;
  overflow-wrap: anywhere;
}

.university-logo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.university-logo-box {
  width: 88px;
  aspect-ratio: 1 / 1;
  align-self: flex-start;
}

@media (max-width: 575.98px) {
  .university-logo {
    width: 40px;
    height: 40px;
  }
}

.university-region {
  color: #adb5bd;
  font-weight: 400;
}

.university-region.is-filtered {
  color: #000;
  font-weight: 700;
}
</style>

<template>
  <div
    class="card h-100 shadow-sm university-card"
    :class="{ 'is-hovered': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    data-testid="university-card"
  >
    <div class="card-body d-flex flex-column">
      <div class="d-flex align-items-stretch gap-3 mb-3">
        <div
          v-if="university.logo_url"
          class="university-logo-box position-relative flex-shrink-0 rounded-3 overflow-hidden bg-white"
        >
          <img
            :src="getLogoUrl(university.logo_url)"
            :alt="`${university.name} logo`"
            class="university-logo"
            loading="lazy"
          />
        </div>

        <div class="university-info flex-grow-1">
          <span v-if="university.published === false" class="badge text-bg-secondary mb-1" data-testid="university-hidden-badge">Hidden from students</span>
          <h2
            class="h5 card-title university-name mb-2"
            data-testid="university-card-name"
          >
            {{ university.name }}
          </h2>

          <p class="card-text text-muted mb-0">
            {{ university.city }}, {{ university.country }}
          </p>

          <p class="small text-muted mb-0">
  Estimated monthly cost: {{ estimatedMonthlyCost }}
</p>
        </div>
      </div>

<div class="mt-auto d-flex align-items-end gap-2">
  <div class="d-flex flex-wrap gap-2">
    <RouterLink
      :to="`/universities/${university.id}`"
      class="btn btn-outline-primary btn-sm"
      data-testid="university-card-link"
    >
      Details
    </RouterLink>

    <RouterLink
      v-if="auth.adminActive"
      :to="{ path: `/universities/${university.id}`, query: { edit: 'details' } }"
      class="btn btn-outline-secondary btn-sm"
      data-testid="university-card-edit"
    >
      Edit
    </RouterLink>

    <button
      class="btn btn-sm"
      :class="shortlisted ? 'btn-secondary' : 'btn-primary'"
      :data-testid="shortlisted ? 'shortlist-remove-btn' : 'shortlist-add-btn'"
      @click="$emit('toggle-shortlist', university)"
    >
      {{ shortlisted ? 'Remove From Shortlist' : 'Add to Shortlist' }}
    </button>
  </div>
  <span class="university-region ms-auto flex-shrink-0 small"
  v-bind:class="{
    'is-filtered':selectedRegion === university.region}">
    {{ university.region }}
  </span>
    </div>
  </div>
</div>
</template>
