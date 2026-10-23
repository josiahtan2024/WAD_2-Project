<script setup>
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
        <div class="display-6 mb-3">🧳</div>
        <h3 class="h5 fw-bold">No budgets yet</h3>
        <p class="text-secondary mb-3">Create your first exchange budget to start planning your expenses.</p>
        <button type="button" class="btn btn-primary" @click="emit('create')">Create Your First Budget</button>
      </div>

      <div v-else>
        <div class="budget-filters rounded-4 p-3 p-md-4 mb-4">
          <div class="row g-3 align-items-end">
            <div class="col-12 col-lg-5">
              <label for="budgetSearch" class="form-label fw-semibold">Search budgets</label>
              <input id="budgetSearch" v-model="searchQuery" type="search" class="form-control" placeholder="Search university, country, region or period" />
            </div>
            <div class="col-12 col-sm-6 col-lg-3">
              <label for="budgetRegion" class="form-label fw-semibold">Filter by region</label>
              <select id="budgetRegion" v-model="regionFilter" class="form-select">
                <option value="">All regions</option>
                <option v-for="region in props.regions" :key="region" :value="region">{{ region }}</option>
              </select>
            </div>
            <div class="col-12 col-sm-6 col-lg-4">
              <label for="budgetSort" class="form-label fw-semibold">Sort by</label>
              <select id="budgetSort" v-model="sortBy" class="form-select">
                <option value="recent">Recently added</option>
                <option value="name">University name (A–Z)</option>
                <option value="country">Country (A–Z)</option>
                <option value="cost">Total cost (low to high)</option>
              </select>
            </div>
          </div>
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
            <span class="small text-secondary">Showing {{ props.filteredBudgets.length }} of {{ props.budgets.length }} budget<span v-if="props.budgets.length !== 1">s</span></span>
            <button v-if="searchQuery || regionFilter || sortBy !== 'recent'" type="button" class="btn btn-sm btn-outline-secondary" @click="resetFilters">Reset search and filters</button>
          </div>
        </div>

        <div v-if="props.filteredBudgets.length === 0" class="empty-state text-center py-5 px-3 rounded-4">
          <div class="display-6 mb-3">🔎</div>
          <h3 class="h5 fw-bold">No matching budgets</h3>
          <p class="text-secondary mb-3">Try another search term or choose a different region.</p>
          <button type="button" class="btn btn-outline-primary" @click="resetFilters">Clear filters</button>
        </div>

        <div v-else class="table-responsive">
          <table class="table align-middle budget-table mb-0">
            <thead><tr><th>University</th><th>Exchange period</th><th>Duration</th><th>Total budget</th><th class="text-end">Actions</th></tr></thead>
            <tbody>
              <tr v-for="budget in props.filteredBudgets" :key="budget.id">
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
      </div>

      <p v-if="props.budgets.length" class="small text-secondary mt-3 mb-0">{{ props.budgets.length }} saved budget<span v-if="props.budgets.length !== 1">s</span> in total</p>
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
