<script setup>
import { computed, ref, watch } from 'vue'

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
const paginatedBudgets = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return props.filteredBudgets.slice(start, start + pageSize)
})

watch([searchQuery, regionFilter, sortBy], () => {
  currentPage.value = 1
})

watch(() => props.filteredBudgets.length, () => {
  currentPage.value = Math.min(currentPage.value, Math.max(pageCount.value, 1))
})

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
  <section class="card border-0 shadow-sm rounded-4 mb-4">
    <div class="card-body p-3 p-md-4">
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 class="h4 fw-bold mb-1">My Budgets</h2>
          <p class="text-secondary mb-0">View and manage your saved exchange budgets.</p>
        </div>
        <button type="button" class="btn btn-primary" @click="emit('create')">＋ Create New Budget</button>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary mb-3" role="status"><span class="visually-hidden">Loading...</span></div>
        <p class="text-secondary mb-0">Loading your budgets...</p>
      </div>

      <div v-else-if="props.budgets.length === 0" class="empty-state text-center py-5 px-3 rounded-4">
        <h3 class="h5 fw-bold">No Budgets Yet</h3>
        <p class="text-secondary mb-3">Create your first exchange budget to start planning your expenses.</p>
        <button type="button" class="btn btn-primary" @click="emit('create')">Create Your First Budget</button>
      </div>

      <div v-else>
        <div class="budget-filters rounded-4 p-3 p-md-4 mb-4">
          <div class="row g-3 align-items-end">
            <div class="col-12 col-lg-5">
              <label for="budgetSearch" class="form-label fw-semibold">Search Budgets</label>
              <input id="budgetSearch" v-model="searchQuery" type="search" class="form-control" placeholder="Search University, Country, Region or Period" />
            </div>
            <div class="col-12 col-sm-6 col-lg-3">
              <label for="budgetRegion" class="form-label fw-semibold">Filter by Region</label>
              <select id="budgetRegion" v-model="regionFilter" class="form-select">
                <option value="">All Regions</option>
                <option v-for="region in props.regions" :key="region" :value="region">{{ region }}</option>
              </select>
            </div>
            <div class="col-12 col-sm-6 col-lg-4">
              <label for="budgetSort" class="form-label fw-semibold">Sort By</label>
              <select id="budgetSort" v-model="sortBy" class="form-select">
                <option value="recent">Recently Added</option>
                <option value="name">University Name (A–Z)</option>
                <option value="country">Country (A–Z)</option>
                <option value="cost">Total Cost (Low to High)</option>
              </select>
            </div>
          </div>
          <div class="d-flex justify-content-between align-items-center gap-2 mt-3">
            <span class="small text-secondary">Showing {{ props.filteredBudgets.length }} of {{ props.budgets.length }} budget<span v-if="props.budgets.length !== 1">s</span></span>
            <button v-if="searchQuery || regionFilter || sortBy !== 'recent'" type="button" class="btn btn-sm btn-outline-secondary" @click="resetFilters">Reset Search and Filters</button>
          </div>
        </div>

        <div v-if="props.filteredBudgets.length === 0" class="empty-state text-center py-5 px-3 rounded-4">
          <h3 class="h5 fw-bold">No Matching Budgets</h3>
          <p class="text-secondary mb-3">Try another search term or choose a different region.</p>
          <button type="button" class="btn btn-outline-primary" @click="resetFilters">Clear Filters</button>
        </div>

        <div v-else class="table-responsive">
          <table class="table align-middle budget-table mb-0">
            <thead><tr><th>University</th><th>Exchange period</th><th>Duration</th><th>Total budget</th><th class="text-end">Actions</th></tr></thead>
            <tbody>
              <tr v-for="budget in paginatedBudgets" :key="budget.id">
                <td data-label="University">
                  <div>
                    <div class="fw-semibold">{{ budget.university_name }}</div>
                    <div class="small text-secondary">{{ budget.university_country }}</div>
                  </div>
                </td>
                <td data-label="Exchange period">{{ budget.period_name || 'Not specified' }}</td>
                <td data-label="Duration">{{ budget.duration_months }} month<span v-if="Number(budget.duration_months) !== 1">s</span></td>
                <td data-label="Total budget" class="fw-semibold text-nowrap">{{ props.formatMoney(budget.total_budget, budget.currency_code || 'SGD') }}</td>
                <td data-label="Actions">
                  <div class="d-flex justify-content-end gap-2 budget-actions">
                    <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('read', budget)">Read</button>
                    <button type="button" class="btn btn-sm btn-outline-primary" @click="emit('edit', budget)">Edit</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" :disabled="props.deletingBudgetId === budget.id" @click="emit('delete', budget)">{{ props.deletingBudgetId === budget.id ? 'Deleting…' : 'Delete' }}</button>
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
              <button class="page-link" type="button" :disabled="currentPage === 1" aria-label="Previous page" @click="goToPage(currentPage - 1)">Previous</button>
            </li>
            <li v-for="page in pageCount" :key="page" class="page-item" :class="{ active: currentPage === page }">
              <button class="page-link" type="button" :aria-current="currentPage === page ? 'page' : undefined" :aria-label="`Page ${page}`" @click="goToPage(page)">{{ page }}</button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === pageCount }">
              <button class="page-link" type="button" :disabled="currentPage === pageCount" aria-label="Next page" @click="goToPage(currentPage + 1)">Next</button>
            </li>
          </ul>
        </nav>
      </div>

      <!-- <p v-if="props.budgets.length" class="small text-secondary mt-3 mb-0">{{ props.budgets.length }} saved budget<span v-if="props.budgets.length !== 1">s</span> in total</p> -->
    </div>
  </section>
</template>

<style scoped>
.budget-table thead th {
  color: #6c757d;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  border-bottom-color: #e8eaf0;
}

.budget-table td { padding-top: 1rem; padding-bottom: 1rem; }
.empty-state { background: #f7f8fc; border: 1px dashed #d9deea; }
.budget-filters { background: #f8f9fc; border: 1px solid #e8eaf0; }

.budget-pagination .page-link {
  color: #0b2348;
  border-color: #d7deea;
  background-color: #fff;
}

.budget-pagination .page-link:hover:not(:disabled) {
  color: #0b2348;
  border-color: #cbdcff;
  background-color: #f1f5fc;
}

.budget-pagination .page-item.active .page-link {
  color: #fff;
  border-color: #0b2348;
  background-color: #0b2348;
}

.budget-pagination .page-link:focus-visible {
  box-shadow: 0 0 0 0.2rem rgba(31, 78, 156, 0.2);
}

.budget-pagination .page-item.disabled .page-link {
  color: #8793a6;
  background-color: #f8faff;
}

@media (max-width: 767.98px) {
  .budget-table,
  .budget-table tbody,
  .budget-table tr,
  .budget-table td { display: block; width: 100%; }

  .budget-table thead { display: none; }
  .budget-table tbody tr {
    margin-bottom: 1rem;
    padding: 0.65rem 0.9rem;
    border: 1px solid #e3e7ef;
    border-radius: 0.9rem;
    background: #fff;
    box-shadow: 0 2px 8px rgba(25, 30, 40, 0.04);
  }

  .budget-table tbody tr:last-child { margin-bottom: 0; }
  .budget-table td {
    display: grid;
    grid-template-columns: minmax(7rem, 0.8fr) minmax(0, 1.2fr);
    align-items: start;
    gap: 0.75rem;
    padding: 0.75rem 0 !important;
    border: 0;
    border-bottom: 1px solid #edf0f5;
    white-space: normal !important;
    overflow-wrap: anywhere;
  }

  .budget-table td::before {
    content: attr(data-label);
    color: #6c757d;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .budget-table td:last-child { border-bottom: 0; }
  .budget-table td[data-label="Actions"] { display: block; padding-top: 0.9rem !important; }
  .budget-table td[data-label="Actions"]::before { display: block; margin-bottom: 0.65rem; }
  .budget-actions { justify-content: flex-start !important; }
  .budget-actions .btn { flex: 1 1 0; }
}
</style>
