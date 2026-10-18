<script setup>
import { supabase } from '@/lib/supabase'

function getLogoUrl(path) {
  const filePath = path.replace(/^university-logos\//, '')

  return supabase.storage
    .from('university-logos')
    .getPublicUrl(filePath).data.publicUrl
}
import { ref } from 'vue'
const isHovered = ref(false)

defineProps({
  university: { type: Object, required: true },
  shortlisted: { type: Boolean, default: false },
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

.university-info {
  min-width: 0;
  overflow-wrap: anywhere;
}

.university-logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

@media (max-width: 575.98px) {
  .university-logo {
    width: 40px;
    height: 40px;
  }
}
</style>

<template>
  <div class="card h-100 shadow-sm university-card" 
  v-bind:class="{ 'is-hovered': isHovered }" 
  v-on:mouseenter="isHovered = true"
  v-on:mouseleave="isHovered = false"
  data-testid="university-card">
    <div class="card-body d-flex align-items-center gap-3">
      <div class="university-info d-flex flex-column flex-grow-1 h-100">
      <h2 class="h5 card-title" data-testid="university-card-name">{{ university.name }}</h2>
      <p class="card-text text-muted mb-1">{{ university.city }}, {{ university.country }}</p>
      <p class="small text-muted mb-2">
  Estimated minimum cost:
  {{ university.region_band_min == null
    ? 'Not available'
    : `SGD ${Number(university.region_band_min).toLocaleString()}` }}
</p>
      <span class="badge text-bg-light align-self-start mb-2 fs-6 ps-0">{{ university.region }}</span>
      <div class="mt-auto d-flex flex-wrap gap-2">
        <RouterLink :to="`/universities/${university.id}`" class="btn btn-outline-primary btn-sm" data-testid="university-card-link">Details</RouterLink>
        <button
          class="btn btn-sm"
          :class="shortlisted ? 'btn-secondary' : 'btn-primary'"
          :data-testid="shortlisted ? 'shortlist-remove-btn' : 'shortlist-add-btn'"
          @click="$emit('toggle-shortlist', university)"
        >
          {{ shortlisted ? 'Remove from shortlist' : 'Add to shortlist' }}
        </button>
      </div>
      </div>
      <img v-if="university.logo_url"
           :src="getLogoUrl(university.logo_url)"
           :alt="`${university.name} logo`"
          class="university-logo flex-shrink-0"
          loading="lazy"/>
    </div>
  </div>
</template>
