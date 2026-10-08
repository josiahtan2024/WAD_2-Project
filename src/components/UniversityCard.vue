<script setup>
defineProps({
  university: { type: Object, required: true },
  shortlisted: { type: Boolean, default: false },
})
defineEmits(['toggle-shortlist'])
</script>

<template>
  <div class="card h-100 shadow-sm" data-testid="university-card">
    <div class="card-body d-flex flex-column">
      <h2 class="h5 card-title" data-testid="university-card-name">{{ university.name }}</h2>
      <p class="card-text text-muted mb-1">{{ university.city }}, {{ university.country }}</p>
      <p class="small text-muted">
  Estimated minimum cost:
  {{ university.region_band_min == null
    ? 'Not available'
    : `SGD ${Number(university.region_band_min).toLocaleString()}` }}
</p>
      <span class="badge text-bg-light align-self-start mb-3">{{ university.region }}</span>
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
