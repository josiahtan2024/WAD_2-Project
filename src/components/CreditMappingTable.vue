<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ mappings: { type: Array, default: () => [] } })
const search = ref('')
const selectedArea = ref('')

const groups = computed(() => {
  const grouped = new Map()
  for (const mapping of props.mappings) {
    const area = mapping.smu_module?.course_area || 'Course area unavailable'
    const key = mapping.smu_module?.id ?? area
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        area,
        school: mapping.smu_module?.school,
        description: mapping.smu_module?.description,
        mappings: [],
      })
    }
    grouped.get(key).mappings.push(mapping)
  }
  return [...grouped.values()].sort((a, b) => a.area.localeCompare(b.area, 'en', { sensitivity: 'base' }))
})

const filteredGroups = computed(() => {
  const query = search.value.trim().toLowerCase()

  return groups.value
    .filter((group) => selectedArea.value === '' || String(group.key) === selectedArea.value)
    .map((group) => ({
      ...group,
      mappings: query ? group.mappings.filter((mapping) => [
        group.area,
        group.school,
        group.description,
        mapping.university_module?.module_code,
        mapping.university_module?.module_name,
        mapping.university_module?.description,
        mapping.university_module?.language,
        mapping.notes,
      ].some((value) => (value ?? '').toLowerCase().includes(query))) : group.mappings,
    }))
    .filter((group) => group.mappings.length)
})

const filteredCount = computed(() => filteredGroups.value.reduce((count, group) => count + group.mappings.length, 0))

function clearFilters() {
  search.value = ''
  selectedArea.value = ''
}
</script>

<template>
  <details class="card border-0 shadow-sm rounded-4" data-testid="credit-mapping-table">
    <summary class="mapping-card-summary d-flex align-items-center justify-content-between gap-3 p-3 p-md-4">
      <div>
        <h2 class="h5 fw-bold mb-1">Course Mapping</h2>
        <p class="text-muted mb-0">SMU course areas mapped to courses at this partner university.</p>
      </div>
      <div class="d-flex align-items-center gap-2 flex-shrink-0">
        <span class="badge rounded-pill text-bg-light border">{{ mappings.length }} {{ mappings.length === 1 ? 'course' : 'courses' }}</span>
        <i class="bi bi-chevron-down mapping-card-chevron" aria-hidden="true"></i>
      </div>
    </summary>
    <div class="card-body p-3 p-md-4 pt-0">
      <p v-if="!mappings.length" class="text-muted mb-0" data-testid="mapping-empty">No course mappings recorded for this university yet.</p>
      <div v-else>
        <div class="mapping-filters rounded-3 p-3 mb-3">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label for="mapping-search" class="form-label fw-semibold">Search Course Mappings</label>
            <input
              id="mapping-search"
              v-model="search"
              type="search"
              class="form-control"
              placeholder="Search course areas or partner courses"
              data-testid="mapping-search"
            />
          </div>
          <div class="col-12 col-md-6">
            <label for="mapping-area-filter" class="form-label fw-semibold">Filter by SMU Course Area</label>
            <select id="mapping-area-filter" v-model="selectedArea" class="form-select" data-testid="mapping-area-filter">
              <option value="">All Course Areas</option>
              <option v-for="group in groups" :key="group.key" :value="String(group.key)">{{ group.area }}</option>
            </select>
          </div>
        </div>
        <div class="d-flex justify-content-between align-items-center gap-2 mt-3">
          <div class="small text-muted" data-testid="mapping-count">{{ filteredCount }} of {{ mappings.length }} mapped courses</div>
          <button v-if="search || selectedArea" type="button" class="btn btn-sm btn-outline-secondary" data-testid="mapping-clear-filters" @click="clearFilters">Reset Search and Filters</button>
        </div>
        </div>
        <p v-if="!filteredGroups.length" class="text-muted mb-0" data-testid="mapping-no-results">No course mappings match your search.</p>
        <div v-else class="mapping-list d-flex flex-column gap-2">
          <details
            v-for="(group, index) in filteredGroups"
            :key="group.key"
            class="mapping-group border rounded-3"
            :open="!!search.trim() || selectedArea !== '' || index === 0"
            data-testid="mapping-group"
          >
            <summary class="mapping-summary d-flex align-items-center justify-content-between gap-3 p-3">
              <div class="min-w-0">
                <div class="small fw-semibold text-uppercase text-secondary mb-1">SMU Course Area</div>
                <div class="fw-bold text-break">{{ group.area }}</div>
                <div v-if="group.school" class="small text-primary fw-semibold">{{ group.school }}</div>
              </div>
              <div class="d-flex align-items-center gap-2 flex-shrink-0">
                <span class="badge rounded-pill text-bg-light border">{{ group.mappings.length }} {{ group.mappings.length === 1 ? 'course' : 'courses' }}</span>
                <i class="bi bi-chevron-down mapping-chevron" aria-hidden="true"></i>
              </div>
            </summary>
            <div class="mapping-group-content px-3 pb-3">
              <p v-if="group.description" class="small text-secondary border-top pt-3 mb-2">{{ group.description }}</p>
              <div v-for="m in group.mappings" :key="m.id" class="partner-course d-flex align-items-start gap-2 py-2 border-top" data-testid="mapping-row">
                <i class="bi bi-arrow-right mapping-arrow mt-1" aria-hidden="true"></i>
                <div class="min-w-0">
                  <div class="fw-semibold">
                    <span v-if="m.university_module?.module_code" class="text-primary me-1">{{ m.university_module.module_code }}</span>
                    {{ m.university_module?.module_name || 'Course name unavailable' }}
                  </div>
                  <div v-if="m.university_module?.description" class="small text-secondary mt-1">{{ m.university_module.description }}</div>
                  <div v-if="m.university_module?.language" class="small text-muted mt-1">Language: {{ m.university_module.language }}</div>
                  <div v-if="m.notes" class="small text-secondary mt-1"><span class="fw-semibold">Notes:</span> {{ m.notes }}</div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  </details>
</template>

<style scoped>
.mapping-card-summary {
  cursor: pointer;
  list-style: none;
}

.mapping-card-summary::-webkit-details-marker {
  display: none;
}

.mapping-card-chevron {
  transition: transform 150ms ease;
}

[data-testid="credit-mapping-table"][open] .mapping-card-chevron {
  transform: rotate(180deg);
}

.mapping-group {
  background: #fff;
}

.mapping-filters {
  background: #f8f9fc;
  border: 1px solid #e8eaf0;
}

.mapping-summary {
  cursor: pointer;
  list-style: none;
  background: #f5f7fb;
  border-radius: inherit;
}

.mapping-summary::-webkit-details-marker {
  display: none;
}

.mapping-group[open] .mapping-summary {
  border-radius: 0.5rem 0.5rem 0 0;
}

.mapping-chevron {
  transition: transform 150ms ease;
}

.mapping-group[open] .mapping-chevron {
  transform: rotate(180deg);
}

.mapping-arrow {
  color: #0b2348;
}

.partner-course:first-child {
  border-top: 0 !important;
}

.min-w-0 {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
