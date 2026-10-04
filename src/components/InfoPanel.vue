<script setup>
defineProps({ university: { type: Object, default: null } })
</script>

<template>
  <div class="card card-body" data-testid="info-panel">
    <p v-if="!university" class="text-muted mb-0" data-testid="info-empty">Click a pin to see details.</p>
    <template v-else>
      <h2 class="h5" data-testid="info-name">{{ university.name }}</h2>
      <p class="text-muted mb-2">{{ university.city }}, {{ university.country }}</p>
      <p class="mb-3">Cost band: {{ university.region_band_min?.toLocaleString() }} to {{ university.region_band_max?.toLocaleString() }} SGD</p>
      <RouterLink :to="`/universities/${university.id}`" class="btn btn-primary btn-sm" data-testid="info-details-link">View details</RouterLink>
    </template>
  </div>
</template>
