<script setup>

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
</style>

<template>
  <div class="card h-100 shadow-sm university-card" 
  v-bind:class="{ 'is-hovered': isHovered }" 
  v-on:mouseenter="isHovered = true"
  v-on:mouseleave="isHovered = false"
  data-testid="university-card">
    <div class="card-body d-flex flex-column">
      <h2 class="h5 card-title" data-testid="university-card-name">{{ university.name }}</h2>
      <p class="card-text text-muted mb-1">{{ university.city }}, {{ university.country }}</p>
      <p class="small text-muted mb-2">
  Estimated minimum cost:
  {{ university.region_band_min == null
    ? 'Not available'
    : `SGD ${Number(university.region_band_min).toLocaleString()}` }}
</p>
      <span class="badge text-bg-light align-self-start mb-2 fs-6 ps-0">{{ university.region }}</span>
      <div class="mt-auto d-flex gap-2">
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
  </div>
</template>
