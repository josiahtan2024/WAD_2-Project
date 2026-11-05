<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ mappings: { type: Array, default: () => [] } })
const search = ref('')
const selectedSchool = ref('')

const groups = computed(() => {
  const grouped = new Map()
  for (const mapping of props.mappings) {
    const area = mapping.smu_module?.course_area || 'Course area unavailable'
    const key = mapping.smu_module?.id ?? area
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        area,
        school: mapping.smu_module?.school?.trim(),
        description: mapping.smu_module?.description,
        mappings: [],
      })
    }
    grouped.get(key).mappings.push(mapping)
  }
  return [...grouped.values()].sort((a, b) =>
    a.area.localeCompare(b.area, 'en', { sensitivity: 'base' })
  )
})

const schools = computed(() =>
  [...new Set(groups.value.map((group) => group.school?.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' })
  )
)

const filteredGroups = computed(() => {
  const query = search.value.trim().toLowerCase()

  return groups.value
    .filter((group) => selectedSchool.value === '' || group.school === selectedSchool.value)
    .map((group) => ({
      ...group,
      mappings: query
        ? group.mappings.filter((mapping) =>
            [
              group.area,
              group.school,
              group.description,
              mapping.university_module?.module_code,
              mapping.university_module?.module_name,
              mapping.university_module?.description,
              mapping.university_module?.language,
              mapping.notes,
            ].some((value) => (value ?? '').toLowerCase().includes(query))
          )
        : group.mappings,
    }))
    .filter((group) => group.mappings.length)
})

const filteredCount = computed(() =>
  filteredGroups.value.reduce((count, group) => count + group.mappings.length, 0)
)

function clearFilters() {
  search.value = ''
  selectedSchool.value = ''
}
</script>

<template>
  <details class="card border rounded-4 shadow-sm overflow-hidden bg-white" data-testid="credit-mapping-table">
    <summary
      class="mapping-card-summary d-flex align-items-center justify-content-between gap-3 p-3 p-md-4"
    >
      <div>
        <h2 class="h5 fw-bold text-navy mb-1">Course Mapping</h2>
        <p class="text-muted small mb-0">
          SMU course areas mapped to courses at this partner university.
        </p>
      </div>
      <div class="d-flex align-items-center gap-2 flex-shrink-0">
        <span class="badge rounded-pill text-navy bg-surface border fw-medium px-2 py-1">
          {{ mappings.length }} {{ mappings.length === 1 ? 'course' : 'courses' }}
        </span>
        <i class="bi bi-chevron-down mapping-card-chevron text-muted" aria-hidden="true"></i>
      </div>
    </summary>
    <div class="card-body p-3 p-md-4 pt-0">
      <p v-if="!mappings.length" class="text-muted small mb-0 py-3 text-center" data-testid="mapping-empty">
        No course mappings recorded for this university yet.
      </p>
      <div v-else>
        <!-- Filter Bar -->
        <div class="filter-panel mb-4 p-4 border rounded-4" data-testid="mapping-filter-bar">
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-6">
              <label for="mapping-search" class="form-label fw-semibold small text-navy"
                >Search Course Mappings</label
              >
              <div class="input-group">
                <span class="input-group-text bg-light border-end-0 text-muted"><i class="bi bi-search"></i></span>
                <input
                  id="mapping-search"
                  v-model="search"
                  type="search"
                  class="form-control border-start-0 shadow-none text-truncate"
                  placeholder="Search by SMU Course Area or Partner Courses"
                  data-testid="mapping-search"
                />
              </div>
            </div>
            <div class="col-12 col-md-6">
              <label for="mapping-school-filter" class="form-label fw-semibold small text-navy"
                >Filter by SMU School</label
              >
              <select
                id="mapping-school-filter"
                v-model="selectedSchool"
                class="form-select shadow-none text-truncate"
                data-testid="mapping-school-filter"
              >
                <option value="">All Schools</option>
                <option v-for="school in schools" :key="school" :value="school">
                  {{ school }}
                </option>
              </select>
            </div>
          </div>
          <div class="d-flex justify-content-between align-items-center gap-2 mt-4 pt-3 border-top">
            <div class="small text-secondary" data-testid="mapping-count">
              Showing <strong class="text-navy">{{ filteredCount }}</strong> of {{ mappings.length }} mapped courses
            </div>
            <button
              v-if="search || selectedSchool"
              type="button"
              class="btn btn-sm btn-outline-secondary rounded-pill px-3"
              data-testid="mapping-clear-filters"
              @click="clearFilters"
            >
              <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
            </button>
          </div>
        </div>

        <div v-if="!filteredGroups.length" class="text-muted small text-center py-4 bg-light rounded-4 border border-dashed my-3" data-testid="mapping-no-results">
          <i class="bi bi-search fs-3 mb-2 d-block text-secondary"></i>
          No course mappings match your search.
        </div>
        <div v-else class="d-flex flex-column gap-3">
          <details
            v-for="(group, index) in filteredGroups"
            :key="group.key"
            class="mapping-group border rounded-4 overflow-hidden"
            :open="!!search.trim() || selectedSchool !== '' || index === 0"
            data-testid="mapping-group"
          >
            <summary
              class="mapping-summary d-flex align-items-center justify-content-between gap-3 p-3"
            >
              <div class="min-w-0">
                <div class="fs-9 fw-bold text-uppercase text-muted tracking-wider mb-0.5">
                  SMU Course Area
                </div>
                <div class="fw-bold text-navy text-break fs-6">{{ group.area }}</div>
                <div v-if="group.school" class="badge bg-light text-secondary border fw-normal mt-1">
                  {{ group.school }}
                </div>
              </div>
              <div class="d-flex align-items-center gap-2 flex-shrink-0">
                <span class="badge rounded-pill text-navy bg-light border fw-medium px-2 py-1">
                  {{ group.mappings.length }} {{ group.mappings.length === 1 ? 'course' : 'courses' }}
                </span>
                <i class="bi bi-chevron-down mapping-chevron text-muted" aria-hidden="true"></i>
              </div>
            </summary>
            <div class="mapping-group-content mapping-scroll px-3 pb-3">
              <p v-if="group.description" class="small text-muted pt-3 mb-2">
                {{ group.description }}
              </p>
              <div
                v-for="m in group.mappings"
                :key="m.id"
                class="partner-course d-flex align-items-start gap-2 py-2 border-top"
                data-testid="mapping-row"
              >
                <i class="bi bi-arrow-right mapping-arrow mt-1 text-primary" aria-hidden="true"></i>
                <div class="min-w-0">
                  <div class="fw-semibold text-navy">
                    <span v-if="m.university_module?.module_code" class="text-primary me-1">{{
                      m.university_module.module_code
                    }}</span>
                    {{ m.university_module?.module_name || 'Course name unavailable' }}
                  </div>
                  <div v-if="m.university_module?.description" class="small text-muted mt-1">
                    {{ m.university_module.description }}
                  </div>
                  <div v-if="m.university_module?.language" class="small text-muted mt-1">
                    <i class="bi bi-translate me-1"></i>Language: {{ m.university_module.language }}
                  </div>
                  <div v-if="m.notes" class="small text-secondary mt-1 bg-light p-2 rounded-3 border">
                    <span class="fw-semibold text-navy">Notes:</span> {{ m.notes }}
                  </div>
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
.text-navy {
  color: var(--app-navy);
}

.bg-surface {
  background-color: var(--app-surface);
}

.border-dashed {
  border-style: dashed !important;
}

.fs-9 {
  font-size: 0.6875rem;
}

.tracking-wider {
  letter-spacing: 0.05em;
}

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

[data-testid='credit-mapping-table'][open] .mapping-card-chevron {
  transform: rotate(180deg);
}

.mapping-group {
  background: #fff;
}

.mapping-group-content {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.25rem;
}
.mapping-scroll {
  overscroll-behavior: contain;
}
.mapping-scroll::-webkit-scrollbar {
  width: 5px;
}
.mapping-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.mapping-scroll::-webkit-scrollbar-thumb {
  background: rgba(20, 27, 77, 0.15);
  border-radius: 4px;
}

.filter-panel {
  padding: 1rem;
  background: var(--app-surface, #f8f9fc);
  border: 1px solid var(--app-border, #e8eaf0);
  border-radius: var(--app-radius, 0.75rem);
}

.filter-panel .btn-outline-secondary {
  --bs-btn-color: var(--app-gray-blue);
  --bs-btn-border-color: #d5d8e5;
  --bs-btn-hover-color: #fff;
  --bs-btn-hover-bg: var(--app-gray-blue);
  --bs-btn-hover-border-color: var(--app-gray-blue);
}

.mapping-summary {
  cursor: pointer;
  list-style: none;
  background: var(--app-surface, #f8f9fc);
  border-radius: inherit;
}

.mapping-summary::-webkit-details-marker {
  display: none;
}

.mapping-group[open] .mapping-summary {
  border-bottom: 1px solid var(--app-border, #e8eaf0);
  border-radius: 0.75rem 0.75rem 0 0;
}

.mapping-chevron {
  transition: transform 150ms ease;
}

.mapping-group[open] .mapping-chevron {
  transform: rotate(180deg);
}

.partner-course:first-child {
  border-top: 0 !important;
}

.min-w-0 {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>