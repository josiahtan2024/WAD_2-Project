<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import { useCourseCartStore } from '@/stores/courseCart'
import { useAuthStore } from '@/stores/auth'
import { useShortlistStore } from '@/stores/shortlist'
import Notice from '@/components/AppNotice.vue'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const uni = useUniversitiesStore()
const cart = useCourseCartStore()
const auth = useAuthStore()
const shortlist = useShortlistStore()

// Logged-out visitors can search; the login link brings them back to the same search afterwards
const loginLink = computed(() => ({ name: 'login', query: { redirect: route.fullPath } }))

const pageLoading = ref(true)
const pageError = ref('')
const cartLimitNotice = ref('')

// Filters (university and area are mirrored in the URL so a search can be shared or bookmarked)
const universityId = ref(route.query.university ? Number(route.query.university) : '')
const selectedAreaId = ref(route.query.area ? Number(route.query.area) : null)
const areaQuery = ref('')
const school = ref('')
const onlyMapped = ref(true)
const moduleQuery = ref('')
const hasActiveFilters = computed(() =>
  universityId.value !== '' || selectedAreaId.value !== null || areaQuery.value.trim() ||
  school.value || !onlyMapped.value || moduleQuery.value.trim()
)

const compareText = (a, b) => (a ?? '').localeCompare(b ?? '', 'en', { sensitivity: 'base' })
const matches = (text, query) => (text ?? '').toLowerCase().includes(query.trim().toLowerCase())

const universities = computed(() => [...uni.items]
  .filter((university) => auth.adminActive || university.published !== false)
  .sort((a, b) => compareText(a.name, b.name)))
const visibleUniversityIds = computed(() => new Set(universities.value.map((university) => university.id)))
const shortlistedUniversities = computed(() =>
  universities.value.filter((university) => shortlist.items.some((item) => item.university_id === university.id))
)
const otherUniversities = computed(() =>
  universities.value.filter((university) => !shortlist.items.some((item) => item.university_id === university.id))
)
const universityName = (id) => uni.items.find((u) => u.id === Number(id))?.name ?? `University ${id}`

const schools = computed(() => [...new Set(uni.modules.map((m) => m.school).filter(Boolean))].sort(compareText))

// Mappings limited to the chosen university (or all universities)
const mappingsInScope = computed(() =>
  uni.allMappings.filter((mapping) => {
    const mappedUniversityId = mapping.university_module?.university_id
    if (!visibleUniversityIds.value.has(mappedUniversityId)) return false
    return universityId.value === '' || mappedUniversityId === universityId.value
  })
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

const allCartGroups = computed(() =>
  Object.entries(cart.byUniversity)
    .map(([id, items]) => ({ universityId: Number(id), name: universityName(id), items }))
    .filter((group) => visibleUniversityIds.value.has(group.universityId))
    .sort((a, b) => compareText(a.name, b.name))
)

// With a university picked, the cart shows only that university's courses (Show all reveals the rest)
const showAllCart = ref(false)
watch(universityId, () => { showAllCart.value = false })
const cartFiltered = computed(() => universityId.value !== '' && !showAllCart.value)
const cartGroups = computed(() =>
  cartFiltered.value
    ? allCartGroups.value.filter((group) => group.universityId === universityId.value)
    : allCartGroups.value
)
const countItems = (groups) => groups.reduce((n, group) => n + group.items.length, 0)
const hiddenCartCount = computed(() => countItems(allCartGroups.value) - countItems(cartGroups.value))
// After Show all, offer to go back to just the picked university (only if other universities are in the cart)
const canHideOtherCarts = computed(() =>
  showAllCart.value && universityId.value !== '' &&
  allCartGroups.value.some((group) => group.universityId !== universityId.value)
)

// Cart changes go to Supabase; a failure is shown from cart.error, so it is not re-thrown here
async function addToCart(mapping) {
  try { 
    const uniId = mapping.university_module.university_id
    if (cart.forUniversity(uniId).length >= cart.maxLimit) {
      cartLimitNotice.value = `You have reached the limit of ${cart.maxLimit} modules for ${universityName(uniId)}. Remove a module from this university's cart to add another.`
      return
    }
    cartLimitNotice.value = ''
    await cart.add(mapping) } catch { /* shown via cart.error */ }
}
// Removals that would also delete saved schedule data wait here for the confirmation dialog:
// { title, description, actionLabel, workingLabel, run }
const pendingRemoval = ref(null)
const removing = ref(false)

async function confirmRemoval() {
  removing.value = true
  try {
    await pendingRemoval.value.run()
  } catch { /* shown via cart.error */ } finally {
    removing.value = false
    pendingRemoval.value = null
  }
}

// Removing a course also deletes its saved schedule timeslots, so ask first when it has any
async function removeFromCart(universityModuleId) {
  try {
    const slots = await cart.scheduledSlotCount(universityModuleId)
    const run = () => cart.remove(universityModuleId)
    if (!slots) return await run()
    const name = cart.items.find((item) => item.universityModuleId === universityModuleId)?.moduleName
    pendingRemoval.value = {
      title: 'Remove Course?',
      description: `${name} has ${slots} timeslot${slots === 1 ? '' : 's'} in your saved schedule. Removing it from the cart also deletes ${slots === 1 ? 'that timeslot' : 'those timeslots'}.`,
      actionLabel: 'Remove',
      workingLabel: 'Removing...',
      run,
    }
  } catch (error) {
    cart.error ??= error.message // a failed timeslot check is not recorded by the store
  }
}
// Clearing the cart also deletes the saved schedules it was used for, so ask first when there are any
async function clearCart() {
  // while filtered to one university, only clear what is shown
  const uniId = cartFiltered.value ? universityId.value : undefined
  try {
    const schedules = await cart.savedScheduleCount(uniId)
    const run = () => cart.clear(uniId)
    if (!schedules) return await run()
    const where = uniId == null ? '' : ` for ${universityName(uniId)}`
    pendingRemoval.value = {
      title: 'Clear Cart?',
      description: `Clearing the cart also deletes your ${schedules === 1 ? 'saved schedule' : `${schedules} saved schedules`}${where}.`,
      actionLabel: 'Clear',
      workingLabel: 'Clearing...',
      run,
    }
  } catch (error) {
    cart.error ??= error.message
  }
}

function selectArea(area) {
  if (selectedAreaId.value === area.id) {
    selectedAreaId.value = null
  } else {
    selectedAreaId.value = area.id
  }
  moduleQuery.value = ''
}

function clearFilters() {
  universityId.value = ''
  selectedAreaId.value = null
  areaQuery.value = ''
  school.value = ''
  onlyMapped.value = true
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
      cart.ensureLoaded(),
      auth.user ? shortlist.load().catch(() => {}) : Promise.resolve(),
    ])
  } catch (error) {
    pageError.value = error.message
  } finally {
    pageLoading.value = false
  }
})
</script>

<template>
  <section class="container py-4 mb-5" data-testid="course-search-page">
    <Notice
      :data-testid="pageError ? 'course-search-error' : undefined"
      :error-message="pageError"
      @dismiss-error="pageError = ''"
    />
    <Notice
      v-if="cartLimitNotice"
      data-testid="course-cart-limit-popup"
      :error-message="cartLimitNotice"
      @dismiss-error="cartLimitNotice = ''"
    />
    <DeleteConfirmDialog
      :open="!!pendingRemoval"
      :title="pendingRemoval?.title ?? ''"
      :action-label="pendingRemoval?.actionLabel ?? ''"
      :working-label="pendingRemoval?.workingLabel ?? ''"
      close-label="Cancel"
      :working="removing"
      @cancel="pendingRemoval = null"
      @confirm="confirmRemoval"
    >
      <template #description>
        {{ pendingRemoval?.description }}
        <br>This action cannot be undone.
      </template>
    </DeleteConfirmDialog>
    <div class="mb-4 pb-3 border-bottom">
      <h1 class="page-title h3 fw-bold text-navy mb-1">Course Search</h1>
      <p class="text-muted small mb-0">
        Pick an SMU course area to view partner university courses mapped to it, then add your selections to your cart for schedule planning.
      </p>
    </div>

    <div class="filter-panel mb-4 p-4 border rounded-4" data-testid="filter-bar">
      <div class="row g-3 align-items-end">
        <div class="col-12 col-lg-4">
          <label for="course-university" class="form-label fw-semibold small text-navy">Partner University</label>
          <select id="course-university" v-model="universityId" class="form-select shadow-none text-truncate" data-testid="course-university-select">
            <option value="">All Partner Universities</option>
            <optgroup v-if="shortlistedUniversities.length" label="My Shortlist">
              <option v-for="u in shortlistedUniversities" :key="u.id" :value="u.id">{{ u.name }}</option>
            </optgroup>
            <optgroup v-if="otherUniversities.length" label="Other Partner Universities">
              <option v-for="u in otherUniversities" :key="u.id" :value="u.id">{{ u.name }}</option>
            </optgroup>
          </select>
        </div>
        <div class="col-12 col-sm-6 col-lg-5">
          <label for="course-area-search" class="form-label fw-semibold small text-navy">SMU Course Area</label>
          <div class="input-group">
            <span class="input-group-text bg-light border-end-0 text-muted"><i class="bi bi-search"></i></span>
            <input
              id="course-area-search"
              v-model="areaQuery"
              type="search"
              class="form-control border-start-0 shadow-none text-truncate"
              placeholder="e.g. XECO900 or Finance"
              data-testid="course-area-search"
            />
          </div>
        </div>
        <div class="col-12 col-sm-6 col-lg-3">
          <label for="course-school" class="form-label fw-semibold small text-navy">SMU School</label>
          <select id="course-school" v-model="school" class="form-select shadow-none text-truncate" data-testid="course-school-select">
            <option value="">All Schools</option>
            <option v-for="s in schools" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="col-12">
          <div class="form-check form-switch mb-0">
            <input id="course-only-mapped" v-model="onlyMapped" class="form-check-input shadow-none" type="checkbox" role="switch" />
            <label for="course-only-mapped" class="form-check-label small text-secondary">Only Show Course Areas with Mapped Courses</label>
          </div>
        </div>
      </div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 pt-3 border-top">
        <span class="small text-secondary" data-testid="course-area-count">Showing <strong class="text-navy">{{ filteredAreas.length }}</strong> of {{ uni.modules.length }} course areas</span>
        <button v-if="hasActiveFilters" type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" data-testid="course-clear-filters" @click="clearFilters">
          <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
        </button>
      </div>
    </div>

    <div v-if="pageLoading" class="text-muted text-center py-5" data-testid="course-search-loading">
      <div class="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
      Loading course information...
    </div>

    <div v-else class="row g-4">
      <!-- Course areas -->
      <div class="col-12 col-lg-4">
        <div class="card search-card rounded-4 overflow-hidden">
          <div class="card-header d-flex justify-content-between align-items-center flex-shrink-0">
            <span class="fw-semibold text-navy">Course Areas</span>
          </div>
          <p v-if="!filteredAreas.length" class="text-muted text-center p-4 mb-0 small" data-testid="course-area-empty">
            No course areas match these filters.
          </p>
          <div v-else class="list-group list-group-flush area-list course-search-scroll flex-grow-1" data-testid="course-area-list">
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
                  <div class="fw-semibold mb-1 area-title">{{ area.course_area }}</div>
                  <div class="small mb-1 area-desc">{{ area.description }}</div>
                  <div class="badge bg-light text-secondary border fw-normal area-school">{{ area.school }}</div>
                </div>
                <span
                  class="badge rounded-pill flex-shrink-0 area-count-badge"
                  :class="countByArea[area.id] ? (area.id === selectedAreaId ? 'bg-white text-dark' : 'text-bg-primary') : 'text-bg-secondary'"
                  :title="`${countByArea[area.id] ?? 0} mapped courses`"
                >{{ countByArea[area.id] ?? 0 }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Mapped foreign courses -->
      <div class="col-12 col-lg-5">
        <div class="card search-card rounded-4 overflow-hidden">
          <div v-if="!selectedArea" class="card-body text-muted text-center py-5 d-flex flex-column align-items-center justify-content-center"
            data-testid="course-area-placeholder">
            <i class="bi bi-arrow-up-circle fs-4 mb-1 d-lg-none" aria-hidden="true"></i>

            <i class="bi bi-arrow-left-circle me-1 d-none d-lg-inline" aria-hidden="true"></i>
            Choose a course area to see the courses mapped to it.
          </div>
          <template v-else>
            <div class="card-header flex-shrink-0">
              <div class="fw-semibold mb-0 text-navy">{{ selectedArea.course_area }} · {{ selectedArea.description }}</div>
              <div class="small text-muted">{{ selectedArea.school }}</div>
            </div>
            <div class="card-body pb-2 bg-light border-bottom flex-grow-0 flex-shrink-0">
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text bg-light border-end-0 text-muted">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  v-model="moduleQuery"
                  type="search"
                  class="form-control shadow-none"
                  placeholder="Search Courses by Name"
                  aria-label="Search Mapped Courses by Name"
                  data-testid="course-module-search"
                />
              </div>
              <p class="small text-muted mt-2 mb-0">
                <strong class="text-navy">{{ areaModuleCount }}</strong> course{{ areaModuleCount === 1 ? '' : 's' }}
                {{ universityId === '' ? 'across all partners' : `at ${universityName(universityId)}` }}
              </p>
            </div>
            <p v-if="!areaModuleGroups.length" class="text-muted small text-center p-4 mb-0" data-testid="course-module-empty">
              No mapped courses for this area{{ universityId === '' ? '' : ' at this university' }}.
            </p>
            <div v-else class="module-list course-search-scroll p-3 flex-grow-1" data-testid="course-module-list">
              <div v-for="group in areaModuleGroups" :key="group.universityId" class="mb-3">
                <h3 class="h6 text-uppercase small text-navy fw-bold mb-2 pb-1 border-bottom">{{ group.name }}</h3>
                <ul class="list-group group-flush gap-2">
                  <li
                    v-for="m in group.rows"
                    :key="m.id"
                    class="list-group-item d-flex justify-content-between align-items-center bg-white border rounded-3 gap-1"
                    data-testid="course-module-item"
                  >
                    <div class="min-w-0">
                      <div class="fw-semibold text-navy">{{ m.university_module.module_name }}</div>
                      <div v-if="m.university_module.language" class="small text-muted">
                        <i class="bi bi-translate me-1"></i>{{ m.university_module.language }}
                      </div>
                    </div>
                    <template v-if="auth.user">
                    <button
                      v-if="cart.has(m.university_module.id)"
                      type="button"
                      class="btn btn-sm btn-success rounded-pill px-3 flex-shrink-0"
                      data-testid="course-remove-btn"
                      :disabled="cart.isPending(m.university_module.id)"
                      @click="removeFromCart(m.university_module.id)"
                    >
                      <i class="bi bi-check-lg me-1" aria-hidden="true"></i> Added
                    </button>
                    <button
                      v-else
                      type="button"
                      class="btn btn-sm btn-outline-primary rounded-pill px-3 flex-shrink-0"
                      data-testid="course-add-btn"
                      :disabled="cart.isPending(m.university_module.id)"
                      @click="addToCart(m)"
                    >
                      <i class="bi bi-plus-lg me-1" aria-hidden="true"></i> Add
                    </button>
                    </template>
                  </li>
                </ul>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Cart -->
      <div class="col-12 col-lg-3">
        <div class="card cart-card search-card rounded-4 overflow-hidden" data-testid="course-cart">
          <div class="card-header d-flex justify-content-between align-items-center flex-shrink-0">
            <span class="fw-semibold text-navy"><i class="bi bi-cart3 me-1 text-primary" aria-hidden="true"></i> My Cart</span>
            <span class="badge text-bg-primary rounded-pill" data-testid="course-cart-count">{{ cart.items.length }}</span>
          </div>
          <div v-if="auth.user && cart.error" class="alert alert-warning small m-3 mb-0 py-2 flex-shrink-0" data-testid="course-cart-error">{{ cart.error }}</div>
          <p v-if="!auth.user" class="text-muted small p-4 mb-0 text-center" data-testid="course-cart-login">
            <RouterLink :to="loginLink">Log in</RouterLink> to save courses to your cart and plan your schedule.
          </p>
          <p v-else-if="!cart.items.length" class="text-muted small p-4 mb-0 text-center" data-testid="course-cart-empty">
            Your cart is empty. Add courses to plan your schedule.
          </p>
          <div v-else class="card-body cart-body course-search-scroll flex-grow-1">
            <p v-if="!cartGroups.length" class="text-muted small mb-2 text-center" data-testid="course-cart-empty-university">
              No courses in your cart for {{ universityName(universityId) }} yet.
            </p>
            <div v-for="group in cartGroups" :key="group.universityId" class="mb-3 pb-3 border-bottom" data-testid="course-cart-group">
              <div class="fw-semibold small text-navy mb-1">{{ group.name }}</div>
              <ul class="list-unstyled mb-2">
                <li
                  v-for="item in group.items"
                  :key="item.universityModuleId"
                  class="d-flex justify-content-between align-items-start gap-2 py-1"
                  data-testid="course-cart-item"
                >
                  <div class="min-w-0 small">
                    <div>{{ item.moduleName }}</div>
                    <div class="text-muted fs-8">{{ item.courseArea }} · {{ item.smuDescription }}</div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-sm btn-link text-danger p-0 flex-shrink-0"
                    :aria-label="`Remove ${item.moduleName}`"
                    data-testid="course-cart-remove-btn"
                    :disabled="cart.isPending(item.universityModuleId)"
                    @click="removeFromCart(item.universityModuleId)"
                  >
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                  </button>
                </li>
              </ul>
              <RouterLink
                :to="`/schedule/${group.universityId}`"
                class="btn btn-sm btn-primary w-100 rounded-pill py-2"
                data-testid="course-cart-schedule-link"
              >
                Plan Schedule ({{ group.items.length }})
              </RouterLink>
            </div>
            <div class="text-center">
            <p v-if="hiddenCartCount" class="small text-muted mb-2" data-testid="course-cart-hidden">
              +{{ hiddenCartCount }} course{{ hiddenCartCount === 1 ? '' : 's' }} for other universities ·
              <button type="button" class="btn btn-link btn-sm p-0 align-baseline" data-testid="course-cart-show-all" @click="showAllCart = true">Show all</button>
            </p>
            <p v-else-if="canHideOtherCarts" class="small text-muted mb-2" data-testid="course-cart-showing-all">
              Showing all universities ·
              <button type="button" class="btn btn-link btn-sm p-0 align-baseline" data-testid="course-cart-show-less" @click="showAllCart = false">Show less</button>
            </p>
            <button
              v-if="cartGroups.length"
              type="button"
              class="btn btn-sm btn-outline-secondary w-100 rounded-pill py-2 mt-2"
              data-testid="course-cart-clear-btn"
              @click="clearCart()"
            >
              {{ cartFiltered ? `Clear ${universityName(universityId)}` : 'Clear Cart' }}
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.area-list,
.module-list,
.cart-body {
  max-height: 45vh;
  overflow-y: auto;
}

@media (min-width: 992px) {
  .search-card {
    height: 70vh;
    display: flex;
    flex-direction: column;
  }

  .area-list,
  .module-list,
  .cart-body {
    max-height: none;
  }
}

.card-header {
  background-color: var(--app-surface, #fff) !important;
}

.course-search-scroll {
  overscroll-behavior: contain;
}

.course-search-scroll::-webkit-scrollbar {
  width: 5px;
}

.course-search-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.course-search-scroll::-webkit-scrollbar-thumb {
  background: rgba(20, 27, 77, 0.15);
  border-radius: 4px;
}

.area-item:not(.active) .area-school {
  color: var(--bs-secondary-color);
}

.area-item.active,
.area-item.active:hover,
.area-item.active:focus {
  background-color: var(--app-navy);
  border-color: var(--app-navy);
  color: #fff;
}

.area-item.active .area-title {
  color: #fff !important;
}

.area-item.active .area-desc {
  color: rgba(255, 255, 255, 0.85);
}

.area-item.active .area-school {
  background-color: rgba(255, 255, 255, 0.15) !important;
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
}

.min-w-0 {
  min-width: 0;
  overflow-wrap: anywhere;
}

.fs-8 {
  font-size: 0.75rem;
}

.filter-panel .btn-outline-secondary {
  --bs-btn-color: var(--app-gray-blue);
  --bs-btn-border-color: #d5d8e5;
  --bs-btn-hover-color: #fff;
  --bs-btn-hover-bg: var(--app-gray-blue);
  --bs-btn-hover-border-color: var(--app-gray-blue);
}
</style>