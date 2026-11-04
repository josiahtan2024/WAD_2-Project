<script setup>
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import { useShortlistStore } from '@/stores/shortlist'
import { useAuthStore } from '@/stores/auth'
import FilterBar from '@/components/FilterBar.vue'
import UniversityCard from '@/components/UniversityCard.vue'
import AdminEditor from '@/components/admin/AdminEditor.vue'
import { useExchangeRatesStore } from '@/stores/exchangeRates'
import { calculateMonthlyCost } from '@/lib/universityCost'
import Notice from '@/components/AppNotice.vue'

const exchangeRates = useExchangeRatesStore()
const uni = useUniversitiesStore()
const shortlist = useShortlistStore()
const auth = useAuthStore()
const router = useRouter()
const adminSection = ref(null)
const gridTopRef = ref(null)
const showHidden = ref(true)
const availableUniversities = computed(() => uni.items.filter((university) =>
  university.published !== false || (auth.adminActive && showHidden.value)
))

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
  const filtered = availableUniversities.value.filter((university) => {
    const fields = [
      university.name,
      university.country,
      university.city,
    ]
 
    const matchesKeyword = fields.some((value) => 
        String(value ?? '').toLowerCase().includes(keyword))
    
    const matchesRegion = !uni.filters.region || university.region === uni.filters.region
    return matchesKeyword && matchesRegion
  })

  return filtered.sort((a, b) => {
    if (auth.adminActive && showHidden.value) {
      const aHidden = a.published === false
      const bHidden = b.published === false
      if (aHidden !== bHidden) {
        return aHidden ? -1 : 1
      }
    }

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

const regions = computed(() => Array.from(new Set(availableUniversities.value.map((u) => u.region))).sort())
const currentPage = ref(1)
const pageSize = 6
const pageCount = computed(() => Math.ceil(results.value.length / pageSize))

const displayedPages = computed(() => {
  const total = pageCount.value
  const current = currentPage.value
  const maxVisible = 5
  
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

const pageResults = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return results.value.slice(start, start + pageSize)
})

watch(currentPage, (newPage, oldPage) => {
  if (newPage > oldPage) {
    nextTick(() => {
      if (gridTopRef.value) {
        const yOffset = -75
        const y = gridTopRef.value.getBoundingClientRect().top + window.pageYOffset + yOffset
        window.scrollTo({ top: y, behavior: 'smooth' })
      }
    })
  }
})

watch(() => [uni.query, uni.filters.region, uni.sortBy], () => {
  currentPage.value = 1
})

watch(pageCount, (count) => {
  if (count > 0 && currentPage.value > count) currentPage.value = count
})

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
  <Notice
    :data-testid="shortlist.error ? 'shortlist-error' : uni.error ? 'universities-error' : exchangeRates.error ? 'exchange-rates-error' : undefined"
    :error-message="shortlist.error || (uni.error ? `Could not load partner universities: ${uni.error}` : exchangeRates.error ? 'Unable to load SGD exchange rates.' : '')"
    @dismiss-error="shortlist.error ? shortlist.error = null : uni.error ? uni.error = null : exchangeRates.error = null"
  >
    <template #actions>
      <button v-if="exchangeRates.error && !shortlist.error && !uni.error" class="btn btn-link btn-sm px-0" type="button" @click="exchangeRates.load()">Retry</button>
    </template>
  </Notice>

  <section class="container py-4 mb-5" data-testid="universities-page">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom">
      <div>
        <h1 class="page-title h3 fw-bold text-navy mb-1">Explore Partner Universities</h1>
        <p class="text-muted small mb-0">SMU Global Experience - Discover your next exchange destination.</p>
      </div>

      <div v-if="auth.adminActive" class="d-flex align-items-center gap-3 flex-wrap flex-shrink-0" data-testid="admin-list-tools">
        <div class="form-check mb-0">
          <input id="show-hidden" v-model="showHidden" class="form-check-input shadow-none" type="checkbox" data-testid="admin-show-hidden" />
          <label class="form-check-label small fw-semibold text-secondary" for="show-hidden">Show Hidden</label>
        </div>
        <button type="button" class="btn btn-primary btn-sm rounded-pill px-3 py-2" data-testid="admin-add-university" @click="adminSection = 'create'">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i> Add University
        </button>
      </div>
    </div>

    <template v-if="auth.adminActive">
      <AdminEditor v-model:section="adminSection" @created="openCreated" />
    </template>

    <FilterBar v-model:query="uni.query" v-model:region="uni.filters.region" v-model:sort-by="uni.sortBy" :regions="regions" :result-count="results.length" :total-count="availableUniversities.length" />
    <div ref="gridTopRef">
    <div v-if="uni.loading" class="text-muted text-center py-5" data-testid="universities-loading">Loading partner universities...</div>
    <div v-else-if="!uni.error && !results.length" class="text-muted text-center py-5 bg-light rounded-4 border border-dashed my-3" data-testid="universities-empty">
      <i class="bi bi-search fs-2 mb-2 d-block text-secondary"></i>No partner universities match your search.</div>
    <div v-else-if="!uni.error" class="row g-3" data-testid="universities-grid">
      <div v-for="u in pageResults" :key="u.id" class="col-12 col-sm-6 col-lg-4">
        <UniversityCard 
        :university="u" 
        :shortlisted="isShortlisted(u.id)" 
        :selected-region="uni.filters.region" 
        @toggle-shortlist="toggle" />
      </div>
    </div>
    </div>

    <nav v-if="pageCount > 1" class="university-pagination mt-5" aria-label="University list pages" data-testid="universities-pagination">
      <ul class="pagination justify-content-center flex-wrap mb-0">
        <li class="page-item"
            :class="{ disabled: currentPage === 1 }"
            :title="currentPage === 1 ? 'You are already on the first page.' : undefined">
          <button class="page-link rounded-start-pill px-3 shadow-none" type="button" :disabled="currentPage === 1" aria-label="Previous page" @click="currentPage--">
            <i class="bi bi-chevron-left me-1" style="font-size: 12px;"></i><span>Prev</span>
          </button>
        </li>
        <li v-for="page in displayedPages" :key="page" class="page-item" :class="{ active: currentPage === page }">
          <button class="page-link px-3 shadow-none" type="button" :aria-current="currentPage === page ? 'page' : undefined" :aria-label="`Page ${page}`" @click="currentPage = page">
            {{ page }}
          </button>
        </li>
        <li class="page-item"
            :class="{ disabled: currentPage === pageCount }"
            :title="currentPage === pageCount ? 'You are already on the last page.' : undefined">
          <button class="page-link rounded-end-pill px-3 shadow-none" type="button" :disabled="currentPage === pageCount" aria-label="Next page" @click="currentPage++">
            <span>Next</span><i class="bi bi-chevron-right ms-1" style="font-size: 12px;"></i>
          </button>
        </li>
      </ul>
    </nav>
  </section>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.border-dashed {
  border-style: dashed !important;
}

.university-pagination .page-link {
  color: var(--app-blue);
  border-color: var(--app-border);
  background-color: #fff;
}

.university-pagination .page-link:hover:not(:disabled) {
  color: var(--app-blue);
  border-color: var(--app-border);
  background-color: var(--app-surface);
}

.university-pagination .page-item.active .page-link {
  color: #fff;
  border-color: var(--app-blue);
  background-color: var(--app-blue);
}

.university-pagination .page-item.disabled .page-link {
  color: #8793a6;
  background-color: var(--app-surface);
}

.university-pagination .page-item.disabled .page-link {
  color: #8793a6;
  background-color: var(--app-surface);
  pointer-events: none;
}
</style>
