<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import { useCourseCartStore } from '@/stores/courseCart'

const route = useRoute()
const router = useRouter()
const uni = useUniversitiesStore()
const cart = useCourseCartStore()

const pageLoading = ref(true)
const pageError = ref('')

// Filters (university and area are mirrored in the URL so a search can be shared or bookmarked)
const universityId = ref(route.query.university ? Number(route.query.university) : '')
const selectedAreaId = ref(route.query.area ? Number(route.query.area) : null)
const areaQuery = ref('')
const school = ref('')
const onlyMapped = ref(true)
const moduleQuery = ref('')

const compareText = (a, b) => (a ?? '').localeCompare(b ?? '', 'en', { sensitivity: 'base' })
const matches = (text, query) => (text ?? '').toLowerCase().includes(query.trim().toLowerCase())

const universities = computed(() => [...uni.items].sort((a, b) => compareText(a.name, b.name)))
const universityName = (id) => uni.items.find((u) => u.id === Number(id))?.name ?? `University ${id}`

const schools = computed(() => [...new Set(uni.modules.map((m) => m.school).filter(Boolean))].sort(compareText))

// Mappings limited to the chosen university (or all universities)
const mappingsInScope = computed(() =>
  universityId.value === ''
    ? uni.allMappings
    : uni.allMappings.filter((m) => m.university_module?.university_id === universityId.value)
)

// Number of mapped foreign courses for each SMU course area id
const countByArea = computed(() => {
  const counts = {}
  for (const m of mappingsInScope.value) {
    const id = m.smu_module?.id
    if (id != null) counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
})

const filteredAreas = computed(() =>
  uni.modules.filter((area) => {
    if (school.value && area.school !== school.value) return false
    if (onlyMapped.value && !countByArea.value[area.id]) return false
    const q = areaQuery.value
    return !q.trim() || matches(area.course_area, q) || matches(area.description, q)
  })
)

const selectedArea = computed(() => uni.modules.find((a) => a.id === selectedAreaId.value) ?? null)

// Foreign courses under the selected course area, grouped by university
const areaModuleGroups = computed(() => {
  if (!selectedArea.value) return []
  const groups = {}
  for (const m of mappingsInScope.value) {
    if (m.smu_module?.id !== selectedArea.value.id) continue
    if (moduleQuery.value.trim() && !matches(m.university_module.module_name, moduleQuery.value)) continue
    ;(groups[m.university_module.university_id] ??= []).push(m)
  }
  return Object.entries(groups)
    .map(([id, rows]) => ({
      universityId: Number(id),
      name: universityName(id),
      rows: rows.sort((a, b) => compareText(a.university_module.module_name, b.university_module.module_name)),
    }))
    .sort((a, b) => compareText(a.name, b.name))
})

const areaModuleCount = computed(() => areaModuleGroups.value.reduce((n, g) => n + g.rows.length, 0))

const cartGroups = computed(() =>
  Object.entries(cart.byUniversity)
    .map(([id, items]) => ({ universityId: Number(id), name: universityName(id), items }))
    .sort((a, b) => compareText(a.name, b.name))
)

function selectArea(area) {
  selectedAreaId.value = area.id
  moduleQuery.value = ''
}

watch([universityId, selectedAreaId], () => {
  const query = {}
  if (universityId.value !== '') query.university = universityId.value
  if (selectedAreaId.value != null) query.area = selectedAreaId.value
  router.replace({ query })
})

onMounted(async () => {
  pageLoading.value = true
  pageError.value = ''
  try {
    await Promise.all([
      uni.items.length ? Promise.resolve() : uni.load(),
      uni.modules.length ? Promise.resolve() : uni.loadModules(),
      uni.allMappings.length ? Promise.resolve() : uni.loadAllMappings(),
    ])
  } catch (error) {
    pageError.value = error.message
  } finally {
    pageLoading.value = false
  }
})
</script>

<template>
  <section data-testid="course-search-page">
    <div class="mb-3">
      <h1 class="h3 mb-1">Course search</h1>
      <p class="text-muted mb-0">
        Pick an SMU course area to see the partner university courses mapped to it, then add the ones you want to your cart for scheduling.
      </p>
    </div>

    <div v-if="pageError" class="alert alert-danger" data-testid="course-search-error">{{ pageError }}</div>

    <!-- Filters -->
    <div class="card card-body mb-3">
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-4">
          <label for="course-university" class="form-label small fw-semibold mb-1">Partner university</label>
          <select id="course-university" v-model="universityId" class="form-select" data-testid="course-university-select">
            <option value="">All universities</option>
            <option v-for="u in universities" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </div>
        <div class="col-12 col-md-4">
          <label for="course-area-search" class="form-label small fw-semibold mb-1">SMU course area</label>
          <input
            id="course-area-search"
            v-model="areaQuery"
            type="search"
            class="form-control"
            placeholder="e.g. XECO900 or Finance"
            data-testid="course-area-search"
          />
        </div>
        <div class="col-12 col-md-4">
          <label for="course-school" class="form-label small fw-semibold mb-1">SMU school</label>
          <select id="course-school" v-model="school" class="form-select" data-testid="course-school-select">
            <option value="">All schools</option>
            <option v-for="s in schools" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="col-12">
          <div class="form-check form-switch mb-0">
            <input id="course-only-mapped" v-model="onlyMapped" class="form-check-input" type="checkbox" role="switch" />
            <label for="course-only-mapped" class="form-check-label small">Only show course areas with mapped courses</label>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pageLoading" class="text-muted" data-testid="course-search-loading">Loading course areas...</div>

    <div v-else class="row g-3">
      <!-- 1. Course areas -->
      <div class="col-12 col-lg-4">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span class="fw-semibold">Course areas</span>
            <span class="badge text-bg-light">{{ filteredAreas.length }}</span>
          </div>
          <p v-if="!filteredAreas.length" class="text-muted p-3 mb-0" data-testid="course-area-empty">
            No course areas match these filters.
          </p>
          <div v-else class="list-group list-group-flush area-list" data-testid="course-area-list">
            <button
              v-for="area in filteredAreas"
              :key="area.id"
              type="button"
              class="list-group-item list-group-item-action area-item"
              :class="{ active: area.id === selectedAreaId }"
              :aria-pressed="area.id === selectedAreaId"
              data-testid="course-area-item"
              @click="selectArea(area)"
            >
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div class="min-w-0">
                  <div class="fw-semibold">{{ area.course_area }}</div>
                  <div class="small">{{ area.description }}</div>
                  <div class="small area-school">{{ area.school }}</div>
                </div>
                <span
                  class="badge rounded-pill flex-shrink-0"
                  :class="countByArea[area.id] ? 'text-bg-primary' : 'text-bg-secondary'"
                  :title="`${countByArea[area.id] ?? 0} mapped courses`"
                >{{ countByArea[area.id] ?? 0 }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Mapped foreign courses -->
      <div class="col-12 col-lg-5">
        <div class="card h-100">
          <div v-if="!selectedArea" class="card-body text-muted" data-testid="course-area-placeholder">
            <i class="bi bi-arrow-left-circle me-1" aria-hidden="true"></i>
            Choose a course area to see the courses mapped to it.
          </div>
          <template v-else>
            <div class="card-header">
              <div class="fw-semibold">{{ selectedArea.course_area }} · {{ selectedArea.description }}</div>
              <div class="small text-muted">{{ selectedArea.school }}</div>
            </div>
            <div class="card-body pb-0">
              <input
                v-model="moduleQuery"
                type="search"
                class="form-control form-control-sm"
                placeholder="Search courses by name"
                aria-label="Search mapped courses by name"
                data-testid="course-module-search"
              />
              <p class="small text-muted mt-2 mb-0">
                {{ areaModuleCount }} course{{ areaModuleCount === 1 ? '' : 's' }}
                {{ universityId === '' ? 'across all universities' : `at ${universityName(universityId)}` }}
              </p>
            </div>
            <p v-if="!areaModuleGroups.length" class="text-muted p-3 mb-0" data-testid="course-module-empty">
              No mapped courses for this area{{ universityId === '' ? '' : ' at this university' }}.
            </p>
            <div v-else class="module-list p-3" data-testid="course-module-list">
              <div v-for="group in areaModuleGroups" :key="group.universityId" class="mb-3">
                <h3 class="h6 text-uppercase small text-muted mb-2">{{ group.name }}</h3>
                <ul class="list-group">
                  <li
                    v-for="m in group.rows"
                    :key="m.id"
                    class="list-group-item d-flex justify-content-between align-items-center gap-2"
                    data-testid="course-module-item"
                  >
                    <div class="min-w-0">
                      <div>{{ m.university_module.module_name }}</div>
                      <div v-if="m.university_module.language" class="small text-muted">{{ m.university_module.language }}</div>
                      <div v-if="m.notes" class="small text-muted">{{ m.notes }}</div>
                    </div>
                    <button
                      v-if="cart.has(m.university_module.id)"
                      type="button"
                      class="btn btn-sm btn-success flex-shrink-0"
                      data-testid="course-remove-btn"
                      @click="cart.remove(m.university_module.id)"
                    >
                      <i class="bi bi-check-lg" aria-hidden="true"></i> Added
                    </button>
                    <button
                      v-else
                      type="button"
                      class="btn btn-sm btn-outline-primary flex-shrink-0"
                      data-testid="course-add-btn"
                      @click="cart.add(m)"
                    >
                      <i class="bi bi-plus-lg" aria-hidden="true"></i> Add
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 3. Cart -->
      <div class="col-12 col-lg-3">
        <div class="card cart-card" data-testid="course-cart">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span class="fw-semibold"><i class="bi bi-cart3 me-1" aria-hidden="true"></i> My cart</span>
            <span class="badge text-bg-primary" data-testid="course-cart-count">{{ cart.items.length }}</span>
          </div>
          <p v-if="!cart.items.length" class="text-muted small p-3 mb-0" data-testid="course-cart-empty">
            Your cart is empty. Add courses to plan your schedule.
          </p>
          <div v-else class="card-body">
            <div v-for="group in cartGroups" :key="group.universityId" class="mb-3" data-testid="course-cart-group">
              <div class="fw-semibold small mb-1">{{ group.name }}</div>
              <ul class="list-unstyled mb-2">
                <li
                  v-for="item in group.items"
                  :key="item.universityModuleId"
                  class="d-flex justify-content-between align-items-start gap-2 py-1 border-bottom"
                  data-testid="course-cart-item"
                >
                  <div class="min-w-0 small">
                    <div>{{ item.moduleName }}</div>
                    <div class="text-muted">{{ item.courseArea }} · {{ item.smuDescription }}</div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-sm btn-link text-danger p-0 flex-shrink-0"
                    :aria-label="`Remove ${item.moduleName}`"
                    data-testid="course-cart-remove-btn"
                    @click="cart.remove(item.universityModuleId)"
                  >
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                  </button>
                </li>
              </ul>
              <RouterLink
                :to="`/schedule/${group.universityId}`"
                class="btn btn-sm btn-primary w-100"
                data-testid="course-cart-schedule-link"
              >
                Plan schedule ({{ group.items.length }})
              </RouterLink>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary w-100"
              data-testid="course-cart-clear-btn"
              @click="cart.clear()"
            >
              Clear cart
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.area-list,
.module-list {
  max-height: 65vh;
  overflow-y: auto;
}

.area-item:not(.active) .area-school {
  color: var(--bs-secondary-color);
}

.area-item.active .area-school {
  opacity: 0.85;
}

.min-w-0 {
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (min-width: 992px) {
  .cart-card {
    position: sticky;
    top: 1rem;
  }
}
</style>
