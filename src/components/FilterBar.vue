<script setup>
defineProps({ regions: { type: Array, default: () => [] } })
const query = defineModel('query', { default: '' })
const region = defineModel('region', { default: null })
const sortBy = defineModel('sortBy', { default: 'name' })
</script>

<template>
  <div class="row g-2 mb-3" data-testid="filter-bar">
    <div class="col-12 col-md-6">
      <input v-model="query" type="search" class="form-control" placeholder="Search by name, country or city" aria-label="Search universities" data-testid="filter-search-input" />
    </div>
    <div class="col-6 col-md-3">
      <select v-model="region" class="form-select" aria-label="Filter by region" data-testid="filter-region-select">
        <option :value="null">All regions</option>
        <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
      </select>
    </div>
    <div class="col-6 col-md-3">
      <select v-model="sortBy" class="form-select" aria-label="Sort by" data-testid="filter-sort-select">
        <option value="name">Sort: Name</option>
        <option value="country">Sort: Country</option>
        <option value="cost">Sort: Cost</option>
      </select>
    </div>
  </div>
</template>
