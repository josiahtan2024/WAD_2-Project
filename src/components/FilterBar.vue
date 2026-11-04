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
  <div class="filter-panel university-filters mb-4 p-4 border rounded-4" data-testid="filter-bar">
    <div class="row g-3 align-items-end">
      <div class="col-12 col-lg-5">
        <label for="universitySearch" class="form-label fw-semibold small text-navy">Search Partner Universities</label>
        <div class="input-group university-search">
          <span class="input-group-text bg-light border-end-0"><i class="bi bi-search text-muted"></i></span>
          <input id="universitySearch" v-model="query" type="search" class="form-control border-start-0 shadow-none" placeholder="Search by Name, Country or City" aria-label="Search Partner Universities" data-testid="filter-search-input" />
        </div>
      </div>
      <div class="col-12 col-sm-6 col-lg-3">
        <label for="universityRegion" class="form-label fw-semibold small text-navy">Filter by Region</label>
        <select id="universityRegion" v-model="region" class="form-select shadow-none" aria-label="Filter by Region" data-testid="filter-region-select">
          <option :value="null">All Regions</option>
          <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>
      <div class="col-12 col-sm-6 col-lg-4">
        <label for="universitySort" class="form-label fw-semibold small text-navy">Sort By</label>
        <select id="universitySort" v-model="sortBy" class="form-select shadow-none" aria-label="Sort By" data-testid="filter-sort-select">
          <option value="name">University Name (A - Z)</option>
          <option value="country">Country (A - Z)</option>
          <option value="cost">Monthly Cost (Low to High)</option>
        </select>
      </div>
    </div>
    
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 pt-3 border-top">
      <span class="small text-secondary">Showing <strong class="text-navy">{{ props.resultCount }}</strong> of {{ props.totalCount }} partner universities</span>
      <button v-if="query || region || sortBy !== 'name'" class="btn btn-sm btn-outline-secondary rounded-pill px-3" type="button" data-testid="clear-filters-btn" @click="clearFilters">
        <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
      </button>
    </div>
  </div>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.filter-panel .btn-outline-secondary {
  --bs-btn-color: var(--app-gray-blue);
  --bs-btn-border-color: #d5d8e5;
  --bs-btn-hover-color: #fff;
  --bs-btn-hover-bg: var(--app-gray-blue);
  --bs-btn-hover-border-color: var(--app-gray-blue);
}

.university-search:focus-within .input-group-text,
.university-search:focus-within .form-control {
  border-color: #86b7fe;
}
</style>