<script setup>
const props = defineProps({
  regions: { type: Array, default: () => [] },
  resultCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
})
const query = defineModel('query', { default: '' })
const region = defineModel('region', { default: null })
const sortBy = defineModel('sortBy', { default: 'name' })

function clearFilters() {
  query.value = ''
  region.value = null
  sortBy.value = 'name'
}
</script>

<template>
  <div class="university-filters rounded-4 p-3 p-md-4 mb-4" data-testid="filter-bar">
    <div class="row g-3 align-items-end">
      <div class="col-12 col-lg-5">
        <label for="universitySearch" class="form-label fw-semibold">Search universities</label>
        <input id="universitySearch" v-model="query" type="search" class="form-control" placeholder="Search by name, country or city" aria-label="Search universities" data-testid="filter-search-input" />
      </div>
      <div class="col-12 col-sm-6 col-lg-3">
        <label for="universityRegion" class="form-label fw-semibold">Filter by region</label>
        <select id="universityRegion" v-model="region" class="form-select" aria-label="Filter by region" data-testid="filter-region-select">
          <option :value="null">All regions</option>
          <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>
      <div class="col-12 col-sm-6 col-lg-4">
        <label for="universitySort" class="form-label fw-semibold">Sort by</label>
        <select id="universitySort" v-model="sortBy" class="form-select" aria-label="Sort by" data-testid="filter-sort-select">
          <option value="name">University name (A–Z)</option>
          <option value="country">Country (A–Z)</option>
          <option value="cost">Monthly cost (low to high)</option>
        </select>
      </div>
    </div>
    <div class="d-flex flex-column align-items-start gap-2 mt-3">
      <span class="small text-secondary">Showing {{ props.resultCount }} of {{ props.totalCount }} universities</span>
      <button v-if="query || region || sortBy !== 'name'" class="btn btn-sm btn-outline-secondary" type="button" data-testid="clear-filters-btn" @click="clearFilters">
        Reset search and filters
      </button>
    </div>
  </div>
</template>

<style scoped>
.university-filters {
  background: #f8f9fc;
  border: 1px solid #e8eaf0;
}
</style>
