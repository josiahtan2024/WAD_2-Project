<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  budgets: { type: Array, default: () => [] },
  filteredBudgets: { type: Array, default: () => [] },
  regions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  deletingBudgetId: { type: [Number, String], default: null },
  formatMoney: { type: Function, required: true },
})

const searchQuery = defineModel('searchQuery', { type: String, default: '' })
const regionFilter = defineModel('regionFilter', { type: String, default: '' })
const sortBy = defineModel('sortBy', { type: String, default: 'recent' })
const currentPage = ref(1)
const pageSize = 6
const pageCount = computed(() => Math.ceil(props.filteredBudgets.length / pageSize))

const windowWidth = ref(window.innerWidth)
const updateWidth = () => { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', updateWidth))
onUnmounted(() => window.removeEventListener('resize', updateWidth))

const isMobile = computed(() => windowWidth.value < 768)
const displayedPages = computed(() => {
  const total = pageCount.value
  const current = currentPage.value
  const maxVisible = isMobile.value ? 3 : 5 
  
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  
  let start = Math.max(1, current - Math.floor(maxVisible / 2))
  let end = start + maxVisible - 1
  
  if (end > total) {
    end = total
    start = Math.max(1, end - maxVisible + 1)
  }
  
  const range = []
  for (let i = start; i <= end; i++) {
    range.push(i)
  }
  
  return range
})

const paginatedBudgets = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return props.filteredBudgets.slice(start, start + pageSize)
})

watch([searchQuery, regionFilter, sortBy], () => {
  currentPage.value = 1
})

watch(
  () => props.filteredBudgets.length,
  () => {
    currentPage.value = Math.min(currentPage.value, Math.max(pageCount.value, 1))
  }
)

function goToPage(page) {
  currentPage.value = Math.min(Math.max(page, 1), pageCount.value)
}

const emit = defineEmits(['create', 'read', 'edit', 'delete'])

function resetFilters() {
  searchQuery.value = ''
  regionFilter.value = ''
  sortBy.value = 'recent'
}
</script>

<template>
  <section class="card border rounded-4 shadow-sm mb-4 bg-white overflow-hidden">
    <div class="card-body p-3 p-md-4">
      <div
        class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom"
      >
        <div>
          <h2 class="h4 fw-bold text-navy mb-1" data-testid="budget-heading">My Budgets</h2>
          <p class="text-muted small mb-0">View and manage your saved exchange budgets.</p>
        </div>
        <button
          type="button"
          class="btn btn-primary btn-sm rounded-pill px-3 py-2"
          data-testid="budget-create-button"
          @click="emit('create')"
        >
          <i class="bi bi-plus-lg me-1"></i> New Budget
        </button>
      </div>

      <div v-if="loading" class="text-center py-5 text-muted">
        <div class="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
        Loading your budgets...
      </div>

      <div
        v-else-if="props.budgets.length === 0"
        class="empty-state text-center py-5 px-3 rounded-4 border border-dashed my-3"
      >
        <i class="bi bi-wallet2 fs-2 text-muted mb-2 d-block"></i>
        <h3 class="h5 fw-semibold text-navy mb-1" data-testid="budget-empty-state">No Budgets Yet</h3>
        <p class="text-muted small mb-3">
          Create your first budget to start planning your expenses.
        </p>
        <button
          type="button"
          class="btn btn-primary rounded-pill px-4"
          data-testid="budget-create-button"
          @click="emit('create')"
        >
          Create First Budget
        </button>
      </div>

      <div v-else>
        <!-- Filter Bar -->
        <div class="filter-panel mb-4 p-4 border rounded-4" data-testid="budget-filter-bar">
          <div class="row g-3 align-items-end">
            <div class="col-12 col-lg-5">
              <label for="budgetSearch" class="form-label fw-semibold small text-navy">Search Budgets</label>
              <div class="input-group">
                <span class="input-group-text bg-light border-end-0 text-muted"><i class="bi bi-search"></i></span>
                <input
                  id="budgetSearch"
                  v-model="searchQuery"
                  type="search"
                  class="form-control border-start-0 shadow-none text-truncate"
                  placeholder="Search by University, Country, Region or Period"
                />
              </div>
            </div>
            <div class="col-12 col-sm-6 col-lg-3">
              <label for="budgetRegion" class="form-label fw-semibold small text-navy">Filter by Region</label>
              <select id="budgetRegion" v-model="regionFilter" class="form-select shadow-none text-truncate">
                <option value="">All Regions</option>
                <option v-for="region in props.regions" :key="region" :value="region">
                  {{ region }}
                </option>
              </select>
            </div>
            <div class="col-12 col-sm-6 col-lg-4">
              <label for="budgetSort" class="form-label fw-semibold small text-navy">Sort By</label>
              <select id="budgetSort" v-model="sortBy" class="form-select shadow-none text-truncate">
                <option value="recent">Recently Added</option>
                <option value="name">University Name (A - Z)</option>
                <option value="country">Country (A - Z)</option>
                <option value="cost">Total Cost (Low to High)</option>
              </select>
            </div>
          </div>
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 pt-3 border-top">
            <span class="small text-secondary"
              >Showing <strong class="text-navy">{{ props.filteredBudgets.length }}</strong> of {{ props.budgets.length }} budget<span
                v-if="props.budgets.length !== 1"
                >s</span
              ></span
            >
            <button
              v-if="searchQuery || regionFilter || sortBy !== 'recent'"
              type="button"
              class="btn btn-sm btn-outline-secondary rounded-pill px-3"
              @click="resetFilters"
            >
              <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
            </button>
          </div>
        </div>

        <div
          v-if="props.filteredBudgets.length === 0"
          class="empty-state text-center py-5 px-3 rounded-4 border border-dashed my-3"
        >
          <i class="bi bi-search fs-2 mb-2 d-block text-secondary"></i>No budgets match your search.
        </div>

        <div v-else class="table-responsive">
          <table class="table align-middle budget-table mb-0" data-testid="budget-table">
            <thead>
              <tr>
                <th class="ps-3">University</th>
                <th>Exchange Period</th>
                <th>Duration</th>
                <th>Total Budget</th>
                <th class="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="budget in paginatedBudgets" :key="budget.id" data-testid="budget-row">
                <td data-label="University" class="ps-3">
                  <div>
                    <div class="fw-semibold text-navy">{{ budget.university_name }}</div>
                    <div class="small text-muted"><i class="bi bi-geo-alt me-1 text-primary"></i>{{ budget.university_country }}</div>
                  </div>
                </td>
                <td data-label="Exchange Period" class="small text-secondary">{{ budget.period_name || 'Not specified' }}</td>
                <td data-label="Duration" class="small text-secondary">
                  {{ budget.duration_months }} month{{ Number(budget.duration_months) !== 1 ? 's' : '' }}
                </td>
                <td data-label="Total Budget" class="fw-bold text-navy text-nowrap">
                  {{ props.formatMoney(budget.total_budget, budget.currency_code || 'SGD') }}
                </td>
                <td data-label="Actions" class="pe-3">
                  <div class="d-flex justify-content-end align-items-center gap-2 budget-actions">
                    <button
                      type="button"
                      class="btn btn-sm btn-primary rounded-pill px-3 py-2"
                      data-testid="budget-read-button"
                      @click="emit('read', budget)"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-2"
                      data-testid="budget-edit-button"
                      @click="emit('edit', budget)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-danger rounded-circle p-2 lh-1 remove-btn"
                      data-testid="budget-delete-btn"
                      :disabled="props.deletingBudgetId === budget.id"
                      @click="emit('delete', budget)"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <nav
          v-if="pageCount > 1"
          class="budget-pagination mt-4"
          aria-label="Budget table pages"
          data-testid="budget-pagination"
        >
          <ul class="pagination justify-content-center flex-wrap mb-0">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button
                class="page-link rounded-start-pill px-3 shadow-none"
                type="button"
                :disabled="currentPage === 1"
                aria-label="Previous page"
                @click="goToPage(currentPage - 1)"
              >
                <i class="bi bi-chevron-left me-1" style="font-size: 12px;"></i>Prev
              </button>
            </li>
            <li
              v-for="page in displayedPages"
              :key="page"
              class="page-item"
              :class="{ active: currentPage === page }"
            >
              <button
                class="page-link px-3 shadow-none"
                type="button"
                :aria-current="currentPage === page ? 'page' : undefined"
                :aria-label="`Page ${page}`"
                @click="goToPage(page)"
              >
                {{ page }}
              </button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === pageCount }">
              <button
                class="page-link rounded-end-pill px-3 shadow-none"
                type="button"
                :disabled="currentPage === pageCount"
                aria-label="Next page"
                @click="goToPage(currentPage + 1)"
              >
                Next<i class="bi bi-chevron-right ms-1" style="font-size: 12px;"></i>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </section>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.border-dashed {
  border-style: dashed !important;
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

.budget-table thead th {
  color: var(--app-navy);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  background-color: var(--app-surface, #f8f9fc);
  border-bottom: 1px solid var(--app-border, #e8eaf0);
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.budget-table td {
  padding-top: 0.875rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid var(--app-border, #e8eaf0);
}

.budget-pagination .page-link {
  color: var(--app-blue);
  border-color: var(--app-border);
  background-color: #fff;
}

.budget-pagination .page-link:hover:not(:disabled) {
  color: var(--app-blue);
  border-color: var(--app-border);
  background-color: var(--app-surface);
}

.budget-pagination .page-item.active .page-link {
  color: #fff;
  border-color: var(--app-blue);
  background-color: var(--app-blue);
}

.budget-pagination .page-item.disabled .page-link {
  color: #8793a6;
  background-color: var(--app-surface);
}

@media (max-width: 767.98px) {
  .budget-table,
  .budget-table tbody,
  .budget-table tr,
  .budget-table td {
    display: block;
    width: 100%;
  }

  .budget-table thead {
    display: none;
  }
  .budget-table tbody tr {
    margin-bottom: 1rem;
    padding: 0.75rem;
    border: 1px solid var(--app-border, #e8eaf0);
    border-radius: 0.75rem;
    background: #fff;
  }

  .budget-table tbody tr:last-child {
    margin-bottom: 0;
  }
  .budget-table td {
    display: grid;
    grid-template-columns: minmax(7rem, 0.8fr) minmax(0, 1.2fr);
    align-items: start;
    gap: 0.75rem;
    padding: 0.5rem 0 !important;
    border: 0;
    border-bottom: 1px solid var(--app-border, #e8eaf0);
    white-space: normal !important;
  }

  .budget-table td::before {
    content: attr(data-label);
    color: var(--bs-secondary-color);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .budget-table td:last-child {
    border-bottom: 0;
  }
  .budget-table td[data-label='Actions'] {
    display: block;
    padding-top: 0.75rem !important;
  }
  .budget-table td[data-label='Actions']::before {
    display: none;
  }
  .budget-actions {
    justify-content: flex-start !important;
  }
  .budget-actions .btn:not(.remove-btn) {
    flex: 1 1 0;
  }
}

.remove-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
}
</style>