<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import { useShortlistStore } from '@/stores/shortlist'
import { useAuthStore } from '@/stores/auth'
import FilterBar from '@/components/FilterBar.vue'
import UniversityCard from '@/components/UniversityCard.vue'
import AdminEditor from '@/components/admin/AdminEditor.vue'
import { useExchangeRatesStore } from '@/stores/exchangeRates'
import { calculateMonthlyCost } from '@/lib/universityCost'

const exchangeRates = useExchangeRatesStore()
const uni = useUniversitiesStore()
const shortlist = useShortlistStore()
const auth = useAuthStore()
const router = useRouter()
const adminSection = ref(null)
const showHidden = ref(true)

// Until the student-owned filter helpers exist, show the unfiltered list instead of crashing.
function getMonthlyCostSGD(university) {
  const cost = university.university_costs
  const total = calculateMonthlyCost(cost)
  const currency = cost?.currency_code?.trim().toUpperCase()
  const rate = exchangeRates.rates[currency]

  if (
    total === null ||
    !Number.isFinite(total) ||
    !currency ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return Infinity
  }

  return total / rate
}
const results = computed(() => {
  const keyword = uni.query.trim().toLowerCase()
  const filtered = uni.items.filter((university) => {
    const fields = [
      university.name,
      university.country,
      university.city,
    ]
 
    const matchesKeyword = fields.some((value) => 
        String(value ?? '').toLowerCase().includes(keyword))
    
    const matchesRegion = !uni.filters.region || university.region === uni.filters.region
    const visible = university.published !== false || (auth.adminActive && showHidden.value)
    return matchesKeyword && matchesRegion && visible
  })

  return filtered.sort((a, b) => {
  if (uni.sortBy === 'country') {
    const countryOrder = (a.country ?? '').localeCompare(
      b.country ?? ''
    )

    if (countryOrder !== 0) return countryOrder
  }

  if (uni.sortBy === 'cost') {
    const costA = getMonthlyCostSGD(a)
    const costB = getMonthlyCostSGD(b)

    if (costA < costB) return -1
    if (costA > costB) return 1
  }

  return a.name.localeCompare(b.name)
})

})
const regions = computed(() => Array.from(new Set(uni.items.map((u) => u.region))).sort())
const currentPage = ref(1)
const pageSize = 6
const pageCount = computed(() => Math.ceil(results.value.length / pageSize))
const pageResults = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return results.value.slice(start, start + pageSize)
})

watch(() => [uni.query, uni.filters.region, uni.sortBy], () => {
  currentPage.value = 1
})

watch(pageCount, (count) => {
  if (count > 0 && currentPage.value > count) currentPage.value = count
})

// a new university starts hidden, so go and fill it in
function openCreated(created) {
  router.push(`/universities/${created.id}`)
}

const isShortlisted = (id) => shortlist.items.some((s) => s.university_id === id)

async function toggle(u) {
  if (!auth.user) return router.push({ name: 'login', query: { redirect: '/universities' } })
  try {
    if (isShortlisted(u.id)) await shortlist.remove(u.id)
    else await shortlist.add(u.id)
  } catch (e) {
    shortlist.error = e.message
  }
}

onMounted(async () => {
  exchangeRates.load()
  try {
    await uni.load()
  } catch (e) {
    uni.error = e.message
  }
  if (auth.user) {
    try {
      await shortlist.load()
    } catch (e) {
      shortlist.error = e.message
    }
  }
})
</script>

<template>
  <div v-if="exchangeRates.error" class="alert alert-warning">
  Unable to load SGD exchange rates.
    <button
      class="btn btn-link btn-sm"
      @click="exchangeRates.load()"
    >
      Retry
    </button>
</div>
  <section data-testid="universities-page">
    <h1 class="h3 fw-bold text-center mb-3">Partner Universities</h1>
    <template v-if="auth.adminActive">
      <div class="d-flex flex-wrap align-items-center justify-content-end gap-3 mb-3" data-testid="admin-list-tools">
        <div class="form-check mb-0">
          <input id="show-hidden" v-model="showHidden" class="form-check-input" type="checkbox" data-testid="admin-show-hidden" />
          <label class="form-check-label" for="show-hidden">Show Hidden Universities</label>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-testid="admin-add-university" @click="adminSection = 'create'">
          <i class="bi bi-plus-lg" aria-hidden="true"></i> Add University
        </button>
      </div>
      <AdminEditor v-model:section="adminSection" @created="openCreated" />
    </template>
    <FilterBar v-model:query="uni.query" v-model:region="uni.filters.region" v-model:sort-by="uni.sortBy" :regions="regions" :result-count="results.length" :total-count="uni.items.length" />

    <div v-if="shortlist.error" class="alert alert-warning" data-testid="shortlist-error">{{ shortlist.error }}</div>
    <div v-if="uni.loading" class="text-muted" data-testid="universities-loading">Loading partner universities...</div>
    <div v-else-if="uni.error" class="alert alert-danger" data-testid="universities-error">Could not load partner universities: {{ uni.error }}</div>
    <p v-else-if="!results.length" class="text-muted" data-testid="universities-empty">No partner universities match your search.</p>
    <div v-else class="row g-3" data-testid="universities-grid">
      <div v-for="u in pageResults" :key="u.id" class="col-12 col-sm-6 col-lg-4">
        <UniversityCard 
        :university="u" 
        :shortlisted="isShortlisted(u.id)" 
        :selected-region="uni.filters.region" 
        @toggle-shortlist="toggle" />
      </div>
    </div>

    <nav v-if="pageCount > 1" class="university-pagination mt-4" aria-label="University list pages" data-testid="universities-pagination">
      <ul class="pagination justify-content-center flex-wrap mb-0">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button class="page-link" type="button" :disabled="currentPage === 1" aria-label="Previous page" @click="currentPage--">
            Previous
          </button>
        </li>
        <li v-for="page in pageCount" :key="page" class="page-item" :class="{ active: currentPage === page }">
          <button class="page-link" type="button" :aria-current="currentPage === page ? 'page' : undefined" :aria-label="`Page ${page}`" @click="currentPage = page">
            {{ page }}
          </button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === pageCount }">
          <button class="page-link" type="button" :disabled="currentPage === pageCount" aria-label="Next page" @click="currentPage++">
            Next
          </button>
        </li>
      </ul>
    </nav>
  </section>
</template>

<style scoped>
.university-pagination .page-link {
  color: #0b2348;
  border-color: #d7deea;
  background-color: #fff;
}

.university-pagination .page-link:hover:not(:disabled) {
  color: #0b2348;
  border-color: #cbdcff;
  background-color: #f1f5fc;
}

.university-pagination .page-item.active .page-link {
  color: #fff;
  border-color: #0b2348;
  background-color: #0b2348;
}

.university-pagination .page-link:focus-visible {
  box-shadow: 0 0 0 0.2rem rgba(31, 78, 156, 0.2);
}

.university-pagination .page-item.disabled .page-link {
  color: #8793a6;
  background-color: #f8faff;
}
</style>
