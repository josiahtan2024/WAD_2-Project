<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import { useAdminUniversitiesStore } from '@/stores/adminUniversities'
import { useReviewsStore } from '@/stores/reviews'
import { useAuthStore } from '@/stores/auth'
import { useShortlistStore } from '@/stores/shortlist'
import CreditMappingTable from '@/components/CreditMappingTable.vue'
import ReviewCarousel from '@/components/ReviewCarousel.vue'
import ReviewForm from '@/components/ReviewForm.vue'
import Notice from '@/components/AppNotice.vue'
import AdminBar from '@/components/admin/AdminBar.vue'
import AdminEditor from '@/components/admin/AdminEditor.vue'
import AdminEditButton from '@/components/admin/AdminEditButton.vue'
import { supabase } from '@/lib/supabase'
import { calculateMonthlyCost } from '@/lib/universityCost'
import { useExchangeRatesStore } from '@/stores/exchangeRates'

const details = ref({ languages: [], modules: [], periods: [] })
const detailsLoading = ref(false)
const detailsError = ref('')
const mappingError = ref('')
const selectedPeriodIndex = ref(0)

const logoUrl = computed(() => {
  const path = university.value?.logo_url
  if (!path) return ''

  if (/^https?:\/\//i.test(path)) return path

  const filePath = path.replace(/^\/?university-logos\//, '')

  return supabase.storage.from('university-logos').getPublicUrl(filePath).data.publicUrl
})

const route = useRoute()
const router = useRouter()
const editing = ref(null) // which admin drawer is open
const uni = useUniversitiesStore()
const admin = useAdminUniversitiesStore()
const reviews = useReviewsStore()
const auth = useAuthStore()
const shortlist = useShortlistStore()
const exchangeRates = useExchangeRatesStore()
const posting = ref(false)
const postError = ref('')
const reviewSuccessMessage = ref('')
const shortlistError = ref('')
const shortlistSaving = ref(false)

let reviewNoticeTimeout = null
watch(reviewSuccessMessage, (message) => {
  if (reviewNoticeTimeout) clearTimeout(reviewNoticeTimeout)
  reviewNoticeTimeout = null
  if (!message) return
  reviewNoticeTimeout = setTimeout(() => {
    reviewSuccessMessage.value = ''
    reviewNoticeTimeout = null
  }, 5000)
})
onUnmounted(() => {
  if (reviewNoticeTimeout) clearTimeout(reviewNoticeTimeout)
})

const university = computed(() => {
  const item = uni.items.find((u) => String(u.id) === route.params.id)
  return item && (auth.adminActive || item.published !== false) ? item : undefined
})
const isShortlisted = computed(() =>
  shortlist.items.some((item) => String(item.university_id) === String(university.value?.id))
)
const universityCost = computed(() => {
  const cost = university.value?.university_costs
  return Array.isArray(cost) ? cost[0] : cost
})
const monthlyCost = computed(() => calculateMonthlyCost(universityCost.value))
const monthlyCostSgd = computed(() => {
  const currency = universityCost.value?.currency_code?.toUpperCase()
  const rate = exchangeRates.rates[currency]
  if (monthlyCost.value === null || !Number.isFinite(rate) || rate <= 0) return null
  return monthlyCost.value / rate
})

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount)))
    return 'Not available'
  try {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
      maximumFractionDigits: 0,
    }).format(Number(amount))
  } catch {
    return `${Number(amount).toLocaleString('en-SG')} ${currency || ''}`.trim()
  }
}

function formatExchangeDate(date) {
  if (!date || date === 'N/A') return 'Not available'
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const selectedPeriod = computed(() => details.value.periods[selectedPeriodIndex.value] ?? null)

async function toggleShortlist() {
  if (!university.value) return
  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  shortlistSaving.value = true
  shortlistError.value = ''
  try {
    if (isShortlisted.value) await shortlist.remove(university.value.id)
    else await shortlist.add(university.value.id)
  } catch (error) {
    shortlistError.value = error.message || 'Unable to update your shortlist.'
  } finally {
    shortlistSaving.value = false
  }
}

onMounted(async () => {
  if (!auth.user) return
  try {
    await shortlist.load()
  } catch (error) {
    shortlistError.value = error.message || 'Unable to load your shortlist.'
  }
})

function distanceFromSMU() {
  const lat = Number(university.value?.lat)
  const lon = Number(university.value?.long)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !lat || !lon) return 'Not available'
  const lat1 = (1.29627 * Math.PI) / 180
  const lat2 = (lat * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLon = ((lon - 103.85185) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return `${Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))} km`
}

async function loadCompareDetails(silent = false) {
  if (!silent) detailsLoading.value = true
  detailsError.value = ''
  try {
    const { data, error } = await supabase
      .from('universities')
      .select(
        `
        university_languages ( instruction_language ),
        university_modules ( id ),
        exchange_periods ( * )
      `
      )
      .eq('id', route.params.id)
      .single()
    if (error) throw error
    details.value = {
      languages: data.university_languages ?? [],
      modules: data.university_modules ?? [],
      periods: (data.exchange_periods ?? []).sort((a, b) =>
        String(a.start_date ?? '').localeCompare(String(b.start_date ?? ''))
      ),
    }
    selectedPeriodIndex.value = silent
      ? Math.min(selectedPeriodIndex.value, Math.max(details.value.periods.length - 1, 0))
      : 0
  } catch (error) {
    detailsError.value = error.message || 'Unable to load university details.'
  } finally {
    detailsLoading.value = false
  }
}

async function loadUniversityMappings(universityId) {
  mappingError.value = ''
  try {
    await uni.loadMappings(universityId)
  } catch (error) {
    if (String(route.params.id) === String(universityId)) {
      mappingError.value = error.message || 'Unable to load course mappings.'
    }
  }
}

async function afterDelete(id) {
  await router.push('/universities')
  admin.forget(id)
}

// the university cards link here with ?edit=details
function openRequestedEditor() {
  if (route.query.edit !== 'details') return
  if (auth.adminActive) editing.value = 'details'
  router.replace({ query: {} })
}

async function post(body, done) {
  posting.value = true
  postError.value = ''
  try {
    await reviews.post(route.params.id, body)
    await reviews.load(route.params.id)
    done()
  } catch (e) {
    postError.value = e.message
  } finally {
    posting.value = false
  }
}

watch(
  () => route.params.id,
  async () => {
    exchangeRates.load()
    try {
      if (!uni.items.length) await uni.load()
      await Promise.all([loadCompareDetails(), loadUniversityMappings(route.params.id)])
      openRequestedEditor()
    } catch (e) {
      uni.error = e.message
    }
  },
  { immediate: true }
)
</script>

<template>
  <section class="container py-4 mb-5" data-testid="university-page">
    <Notice
      :data-testid="uni.error ? 'university-error' : shortlistError ? 'shortlist-error' : undefined"
      :error-message="uni.error || shortlistError"
      :success-message="reviewSuccessMessage"
      @dismiss-error="uni.error ? (uni.error = null) : (shortlistError = '')"
      @dismiss-success="reviewSuccessMessage = ''"
    />
    <div v-if="uni.loading" class="text-muted text-center py-5" data-testid="university-loading">
    <div class="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
    Loading partner university...
    </div>    
    <p v-else-if="!uni.error && !university" class="text-muted small" data-testid="university-not-found">
      University not found. <RouterLink to="/universities" class="link-primary">Back to list</RouterLink>
    </p>
    <template v-else-if="!uni.error">
      <template v-if="auth.adminActive">
        <AdminBar
          :university="university"
          :details="details"
          @edit="editing = $event"
          @changed="loadCompareDetails(true)"
        />
        <AdminEditor
          v-model:section="editing"
          :university="university"
          :details="details"
          @changed="loadCompareDetails(true)"
          @deleted="afterDelete"
        />
      </template>

      <header class="university-header d-flex flex-column flex-md-row align-items-center align-items-md-center text-center text-md-start gap-4 mb-4 pb-4 border-bottom">
        <div class="detail-logo-box p-0 bg-white border rounded-4 shadow-sm flex-shrink-0 overflow-hidden d-flex align-items-center justify-content-center">
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="`${university.name} logo`"
            class="detail-logo w-100 h-100"
          />
          <i v-else class="bi bi-mortarboard fs-1 text-muted"></i>
        </div>

        <div class="flex-grow-1 min-w-0">
          <h1 class="page-title h3 fw-bold text-navy mb-1">{{ university.name }}</h1>
          <p class="text-muted small mb-3">
            <i class="bi bi-geo-alt text-primary me-1"></i>{{ university.city }}, {{ university.country }}
          </p>

          <div class="d-flex align-items-center justify-content-center justify-content-md-start gap-2 flex-wrap">
            <a
              v-if="university.website_url"
              class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-2"
              :href="university.website_url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i class="bi bi-globe me-1"></i> Visit Website
            </a>
            <button
              type="button"
              class="btn btn-sm rounded-pill px-3 px-sm-4 py-2"
              :class="isShortlisted ? 'btn-primary' : 'btn-outline-primary'"
              :disabled="shortlistSaving"
              data-testid="university-shortlist-btn"
              @click="toggleShortlist"
            >
              <i
                class="bi me-1"
                :class="isShortlisted ? 'bi-bookmark-fill' : 'bi-bookmark-plus'"
                aria-hidden="true"
              ></i>
              {{ isShortlisted ? 'Shortlisted' : 'Shortlist' }}
            </button>
          </div>
        </div>
      </header>

      <div v-if="detailsError" class="alert alert-warning rounded-4 border-0 small" role="status">
        Some university comparison details could not be loaded: {{ detailsError }}
      </div>
      <div v-if="detailsLoading" class="text-muted small mb-3" role="status">
        <span class="spinner-border spinner-border-sm me-1 text-primary"></span> Loading details...
      </div>

      <!-- Main Info Cards -->
      <div class="row g-3 mb-4">
        <!-- Location Card -->
        <div class="col-12 col-lg-5">
          <section class="card border rounded-4 shadow-sm h-100 bg-white">
            <div class="card-body p-3 p-md-4">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h2 class="h5 fw-bold text-navy mb-0">Location</h2>
                <AdminEditButton
                  v-if="auth.adminActive"
                  label="location"
                  @click="editing = 'location'"
                />
              </div>
              <dl class="detail-list mb-0">
                <div>
                  <dt>City</dt>
                  <dd>{{ university.city || 'Not available' }}</dd>
                </div>
                <div>
                  <dt>State / Province</dt>
                  <dd>{{ university.state || 'Not available' }}</dd>
                </div>
                <div>
                  <dt>Country</dt>
                  <dd>{{ university.country || 'Not available' }}</dd>
                </div>
                <div>
                  <dt>Region</dt>
                  <dd>{{ university.region || 'Not available' }}</dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>{{ university.timezone || 'Not available' }}</dd>
                </div>
                <div>
                  <dt>Distance from SG</dt>
                  <dd>{{ distanceFromSMU() }}</dd>
                </div>
              </dl>
              <RouterLink
                v-if="university.lat && university.long"
                class="btn btn-outline-primary btn-sm rounded-pill w-100 mt-3 py-2"
                :to="{ name: 'home', query: { university: university.id } }"
              >
                <i class="bi bi-map me-1"></i> Open Map Location
              </RouterLink>
            </div>
          </section>
        </div>

        <!-- Cost Card -->
        <div class="col-12 col-lg-7">
          <section class="card border rounded-4 shadow-sm h-100 bg-white">
            <div class="card-body p-3 p-md-4">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h2 class="h5 fw-bold text-navy mb-0">Cost</h2>
                <AdminEditButton v-if="auth.adminActive" label="cost" @click="editing = 'cost'" />
              </div>
              <template v-if="universityCost">
                <div class="cost-stat-card p-3 rounded-3 border bg-light mb-3">
                  <div class="small text-muted fw-semibold text-uppercase tracking-wider fs-9 mb-1" data-testid="university-monthly-total-label">
                    Estimated Monthly Total
                  </div>
                  <div class="h3 fw-bold text-navy mb-1">
                    {{ formatMoney(monthlyCost, universityCost.currency_code) }}
                  </div>
                  <div class="small text-muted" data-testid="university-monthly-total-sgd">
                    Estimated in SGD: <strong class="text-primary">{{ formatMoney(monthlyCostSgd, 'SGD') }}</strong>
                  </div>
                </div>
                <dl class="detail-list mb-0">
                  <div data-testid="university-cost-accommodation">
                    <dt>Accommodation</dt>
                    <dd>
                      {{ formatMoney(universityCost.accommodation, universityCost.currency_code) }}
                    </dd>
                  </div>
                  <div data-testid="university-cost-food">
                    <dt>Food</dt>
                    <dd>{{ formatMoney(universityCost.food, universityCost.currency_code) }}</dd>
                  </div>
                  <div data-testid="university-cost-transport">
                    <dt>Transport</dt>
                    <dd>
                      {{ formatMoney(universityCost.transport, universityCost.currency_code) }}
                    </dd>
                  </div>
                  <div data-testid="university-cost-personal">
                    <dt>Personal Expenses</dt>
                    <dd>
                      {{
                        formatMoney(universityCost.personal_expenses, universityCost.currency_code)
                      }}
                    </dd>
                  </div>
                </dl>
              </template>
              <p v-else class="text-muted small mb-0 py-4 text-center border border-dashed rounded-3">Cost information is not available.</p>
            </div>
          </section>
        </div>

        <!-- Academics Card -->
        <div class="col-12 col-lg-5">
          <section class="card border rounded-4 shadow-sm h-100 bg-white">
            <div class="card-body p-3 p-md-4">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h2 class="h5 fw-bold text-navy mb-0">Academics</h2>
                <AdminEditButton
                  v-if="auth.adminActive"
                  label="academics"
                  @click="editing = 'academics'"
                />
              </div>
              <dl class="detail-list mb-0">
                <div>
                  <dt>Mapped Modules</dt>
                  <dd>{{ details.modules.length }}</dd>
                </div>
                <div>
                  <dt>Instruction Language</dt>
                  <dd>
                    {{
                      details.languages
                        .map((item) => item.instruction_language)
                        .filter(Boolean)
                        .join(', ') || 'Not available'
                    }}
                  </dd>
                </div>
                <div>
                  <dt>Exchange Programmes</dt>
                  <dd>{{ details.periods.length }}</dd>
                </div>
              </dl>
              <a
                v-if="university.modules_url"
                class="btn btn-outline-primary btn-sm rounded-pill w-100 mt-3 py-2"
                :href="university.modules_url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i class="bi bi-journal-bookmark me-1"></i> View Course Catalogue
              </a>
            </div>
          </section>
        </div>

        <!-- Exchange Periods Card -->
        <div class="col-12 col-lg-7">
          <section class="card border rounded-4 shadow-sm h-100 bg-white">
            <div class="card-body p-3 p-md-4">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h2 class="h5 fw-bold text-navy mb-0">Exchange</h2>
                <AdminEditButton
                  v-if="auth.adminActive"
                  label="exchange"
                  @click="editing = 'exchange'"
                />
              </div>
              <template v-if="details.periods.length">
                <div class="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Exchange periods">
                  <button
                    v-for="(period, index) in details.periods"
                    :key="period.id || index"
                    type="button"
                    class="btn btn-sm rounded-pill px-3"
                    :class="selectedPeriodIndex === index ? 'btn-primary' : 'btn-outline-primary'"
                    :aria-pressed="selectedPeriodIndex === index"
                    @click="selectedPeriodIndex = index"
                  >
                    {{ formatExchangeDate(period.start_date) }}
                  </button>
                </div>
                <dl v-if="selectedPeriod" class="detail-list mb-0">
                  <div>
                    <dt>Programme</dt>
                    <dd>{{ selectedPeriod.period_name || 'Not available' }}</dd>
                  </div>
                  <div>
                    <dt>Term</dt>
                    <dd>{{ selectedPeriod.term || 'Not available' }}</dd>
                  </div>
                  <div>
                    <dt>Academic Year</dt>
                    <dd>{{ selectedPeriod.academic_year || 'Not available' }}</dd>
                  </div>
                  <div>
                    <dt>Exchange Period</dt>
                    <dd>
                      {{ formatExchangeDate(selectedPeriod.start_date) }} -
                      {{ formatExchangeDate(selectedPeriod.end_date) }}
                    </dd>
                  </div>
                  <div>
                    <dt>Temperature</dt>
                    <dd>
                      {{ selectedPeriod.min_temperature ?? 'Not available' }} -
                      {{ selectedPeriod.max_temperature ?? 'Not available' }} °C
                    </dd>
                  </div>
                  <div>
                    <dt>Overview</dt>
                    <dd>{{ selectedPeriod.description || 'Not available' }}</dd>
                  </div>
                </dl>
              </template>
              <p v-else class="text-muted small mb-0 py-4 text-center border border-dashed rounded-3">
                Exchange period information is not available.
              </p>
            </div>
          </section>
        </div>
      </div>

      <!-- Lower Sections: Course Mapping & Reviews -->
      <div class="row g-4">
        <div class="col-12">
          <div v-if="mappingError" class="alert alert-warning rounded-4 border-0 small" role="status">
            {{ mappingError }}
          </div>
          <p v-else-if="uni.mappingsLoading" class="text-muted small" data-testid="mapping-loading">
            <span class="spinner-border spinner-border-sm me-1 text-primary"></span> Loading course mappings...
          </p>
          <CreditMappingTable v-else :mappings="uni.mappings" />
        </div>
        <div class="col-12">
          <div v-if="reviews.error" class="alert alert-warning rounded-4 border-0 small" data-testid="reviews-error">
            {{ reviews.error }}
          </div>
          <section class="card border rounded-4 shadow-sm bg-white" aria-label="Reviews">
            <div class="card-body p-3 p-md-4">
              <ReviewCarousel :reviews="reviews.items" @success="reviewSuccessMessage = $event" />
              <div v-if="postError" class="alert alert-danger rounded-4 py-2 small mt-2" data-testid="review-post-error">
                {{ postError }}
              </div>
              <ReviewForm
                :logged-in="!!auth.user"
                :submitting="posting"
                @submit="post"
                @success="reviewSuccessMessage = $event"
              />
            </div>
          </section>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
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

.detail-logo-box {
  width: 90px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (min-width: 768px) {
  .detail-logo-box {
    width: 115px;
    height: 115px;
  }
}

.detail-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.cost-stat-card {
  background-color: var(--app-surface, #f8f9fc) !important;
  border-color: var(--app-border, #e8eaf0) !important;
}

.detail-list {
  display: grid;
  gap: 0.75rem;
}

.detail-list > div {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--app-border, #e8eaf0);
}

.detail-list > div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.detail-list dt {
  color: var(--bs-secondary-color);
  font-weight: 400;
  font-size: 0.875rem;
}

.detail-list dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--app-navy);
}

.university-heading {
  max-width: 100%;
  overflow-wrap: anywhere;
}
</style>