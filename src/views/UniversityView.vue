<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import { useAdminUniversitiesStore } from '@/stores/adminUniversities'
import { useReviewsStore } from '@/stores/reviews'
import { useAuthStore } from '@/stores/auth'
import CreditMappingTable from '@/components/CreditMappingTable.vue'
import ReviewCarousel from '@/components/ReviewCarousel.vue'
import ReviewForm from '@/components/ReviewForm.vue'
import AdminBar from '@/components/admin/AdminBar.vue'
import AdminEditor from '@/components/admin/AdminEditor.vue'
import AdminEditButton from '@/components/admin/AdminEditButton.vue'
import { supabase } from '@/lib/supabase'
import { calculateMonthlyCost } from '@/lib/universityCost'
import { useExchangeRatesStore } from '@/stores/exchangeRates'

const details = ref({ languages: [], modules: [], periods: [] })
const detailsLoading = ref(false)
const detailsError = ref('')
const selectedPeriodIndex = ref(0)

const logoUrl = computed(() => {
  const path = university.value?.logo_url
  if (!path) return ''

  if (/^https?:\/\//i.test(path)) return path

  const filePath = path.replace(/^\/?university-logos\//, '')

  return supabase.storage
    .from('university-logos')
    .getPublicUrl(filePath).data.publicUrl
})

const route = useRoute()
const router = useRouter()
const editing = ref(null) // which admin drawer is open
const uni = useUniversitiesStore()
const admin = useAdminUniversitiesStore()
const reviews = useReviewsStore()
const auth = useAuthStore()
const exchangeRates = useExchangeRatesStore()
const posting = ref(false)
const postError = ref('')

const university = computed(() => uni.items.find((u) => String(u.id) === route.params.id))
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
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return 'Not available'
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

function distanceFromSmU() {
  const lat = Number(university.value?.lat)
  const lon = Number(university.value?.long)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !lat || !lon) return 'Not available'
  const lat1 = 1.29627 * Math.PI / 180
  const lat2 = lat * Math.PI / 180
  const dLat = lat2 - lat1
  const dLon = (lon - 103.85185) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return `${Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))} km`
}

async function loadCompareDetails(silent = false) {
  if (!silent) detailsLoading.value = true
  detailsError.value = ''
  try {
    const { data, error } = await supabase
      .from('universities')
      .select(`
        university_languages ( instruction_language ),
        university_modules ( id ),
        exchange_periods ( * )
      `)
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
    selectedPeriodIndex.value = silent ? Math.min(selectedPeriodIndex.value, Math.max(details.value.periods.length - 1, 0)) : 0
  } catch (error) {
    detailsError.value = error.message || 'Unable to load university details.'
  } finally {
    detailsLoading.value = false
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

watch(() => route.params.id, async () => {
  exchangeRates.load()
  try {
    if (!uni.items.length) await uni.load()
    await loadCompareDetails()
    openRequestedEditor()
  } catch (e) {
    uni.error = e.message
  }
}, { immediate: true })
</script>

<template>
  <section data-testid="university-page">
    <div v-if="uni.loading" class="text-muted" data-testid="university-loading">Loading...</div>
    <div v-else-if="uni.error" class="alert alert-danger" data-testid="university-error">{{ uni.error }}</div>
    <p v-else-if="!university" class="text-muted" data-testid="university-not-found">University not found. <RouterLink to="/universities">Back to list</RouterLink></p>
    <template v-else>
      <template v-if="auth.adminActive">
        <AdminBar :university="university" :details="details" @edit="editing = $event" @changed="loadCompareDetails(true)" />
        <AdminEditor v-model:section="editing" :university="university" :details="details" @changed="loadCompareDetails(true)" @deleted="afterDelete" />
      </template>
      <header class="university-header d-flex flex-column align-items-center text-center gap-2 mb-4">
        <div class="university-heading">
          <h1 class="h3 fw-bold mb-2">{{ university.name }}</h1>
          <p class="text-muted mb-0">
            {{ university.city }}, {{ university.country }}
          </p>
        </div>
        <img
          v-if="logoUrl"
          :src="logoUrl"
          :alt="`${university.name} logo`"
          class="detail-logo rounded-3"/>
        <a
          v-if="university.website_url"
          class="btn btn-outline-primary btn-sm"
          :href="university.website_url"
          target="_blank"
          rel="noopener noreferrer"
        >Visit website</a>
      </header>
      <div v-if="detailsError" class="alert alert-warning" role="status">Some university comparison details could not be loaded: {{ detailsError }}</div>
      <div v-if="detailsLoading" class="text-muted mb-3" role="status">Loading university details...</div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-lg-5">
          <section class="card border-0 shadow-sm rounded-4 h-100">
            <div class="card-body p-3 p-md-4">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h2 class="h5 fw-bold mb-0">Location</h2>
                <AdminEditButton v-if="auth.adminActive" label="location" @click="editing = 'location'" />
              </div>
              <dl class="detail-list mb-0">
                <div><dt>City</dt><dd>{{ university.city || 'Not available' }}</dd></div>
                <div><dt>State / province</dt><dd>{{ university.state || 'Not available' }}</dd></div>
                <div><dt>Country</dt><dd>{{ university.country || 'Not available' }}</dd></div>
                <div><dt>Region</dt><dd>{{ university.region || 'Not available' }}</dd></div>
                <div><dt>Timezone</dt><dd>{{ university.timezone || 'Not available' }}</dd></div>
                <div><dt>Distance from SMU</dt><dd>{{ distanceFromSmU() }}</dd></div>
              </dl>
              <a
                v-if="university.lat && university.long"
                class="btn btn-outline-primary btn-sm mt-3"
                :href="`https://www.google.com/maps/search/?api=1&query=${university.lat},${university.long}`"
                target="_blank"
                rel="noopener noreferrer"
              >Open map</a>
            </div>
          </section>
        </div>

        <div class="col-12 col-lg-7">
          <section class="card border-0 shadow-sm rounded-4 h-100">
            <div class="card-body p-3 p-md-4">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h2 class="h5 fw-bold mb-0">Cost</h2>
                <AdminEditButton v-if="auth.adminActive" label="cost" @click="editing = 'cost'" />
              </div>
              <template v-if="universityCost">
                <div class="mb-3">
                  <div class="small text-secondary">Estimated monthly total</div>
                  <div class="h4 fw-bold mb-0">{{ formatMoney(monthlyCost, universityCost.currency_code) }}</div>
                  <div class="small text-secondary">Estimated in SGD: {{ formatMoney(monthlyCostSgd, 'SGD') }}</div>
                </div>
                <dl class="detail-list mb-0">
                  <div><dt>Accommodation</dt><dd>{{ formatMoney(universityCost.accommodation, universityCost.currency_code) }}</dd></div>
                  <div><dt>Food</dt><dd>{{ formatMoney(universityCost.food, universityCost.currency_code) }}</dd></div>
                  <div><dt>Transport</dt><dd>{{ formatMoney(universityCost.transport, universityCost.currency_code) }}</dd></div>
                  <div><dt>Personal expenses</dt><dd>{{ formatMoney(universityCost.personal_expenses, universityCost.currency_code) }}</dd></div>
                </dl>
              </template>
              <p v-else class="text-secondary mb-0">Cost information is not available.</p>
            </div>
          </section>
        </div>

        <div class="col-12 col-lg-5">
          <section class="card border-0 shadow-sm rounded-4 h-100">
            <div class="card-body p-3 p-md-4">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h2 class="h5 fw-bold mb-0">Academics</h2>
                <AdminEditButton v-if="auth.adminActive" label="academics" @click="editing = 'academics'" />
              </div>
              <dl class="detail-list mb-0">
                <div><dt>Mapped modules</dt><dd>{{ details.modules.length }}</dd></div>
                <div><dt>Instruction language</dt><dd>{{ details.languages.map(item => item.instruction_language).filter(Boolean).join(', ') || 'Not available' }}</dd></div>
                <div><dt>Exchange programmes</dt><dd>{{ details.periods.length }}</dd></div>
              </dl>
              <a
                v-if="university.modules_url"
                class="btn btn-outline-primary btn-sm mt-3"
                :href="university.modules_url"
                target="_blank"
                rel="noopener noreferrer"
              >View course catalogue</a>
            </div>
          </section>
        </div>

        <div class="col-12 col-lg-7">
          <section class="card border-0 shadow-sm rounded-4 h-100">
            <div class="card-body p-3 p-md-4">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h2 class="h5 fw-bold mb-0">Exchange</h2>
                <AdminEditButton v-if="auth.adminActive" label="exchange" @click="editing = 'exchange'" />
              </div>
              <template v-if="details.periods.length">
                <div class="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Exchange periods">
                  <button
                    v-for="(period, index) in details.periods"
                    :key="period.id || index"
                    type="button"
                    class="btn btn-sm"
                    :class="selectedPeriodIndex === index ? 'btn-primary' : 'btn-outline-primary'"
                    :aria-pressed="selectedPeriodIndex === index"
                    @click="selectedPeriodIndex = index"
                  >{{ formatExchangeDate(period.start_date) }}</button>
                </div>
                <dl v-if="selectedPeriod" class="detail-list mb-0">
                  <div><dt>Programme</dt><dd>{{ selectedPeriod.period_name || 'Not available' }}</dd></div>
                  <div><dt>Term</dt><dd>{{ selectedPeriod.term || 'Not available' }}</dd></div>
                  <div><dt>Academic year</dt><dd>{{ selectedPeriod.academic_year || 'Not available' }}</dd></div>
                  <div><dt>Exchange period</dt><dd>{{ formatExchangeDate(selectedPeriod.start_date) }} to {{ formatExchangeDate(selectedPeriod.end_date) }}</dd></div>
                  <div><dt>Temperature</dt><dd>{{ selectedPeriod.min_temperature ?? 'Not available' }} – {{ selectedPeriod.max_temperature ?? 'Not available' }} °C</dd></div>
                  <div class="detail-description"><dt>Overview</dt><dd>{{ selectedPeriod.description || 'Not available' }}</dd></div>
                </dl>
              </template>
              <p v-else class="text-secondary mb-0">Exchange period information is not available.</p>
            </div>
          </section>
        </div>
      </div>

      <div class="row g-3">
        <div :class="uni.mappings.length ? 'col-12 col-lg-7' : 'col-12'"><CreditMappingTable :mappings="uni.mappings" /></div>
        <div class="col-12">
          <div v-if="reviews.error" class="alert alert-warning" data-testid="reviews-error">{{ reviews.error }}</div>
          <ReviewCarousel :reviews="reviews.items" />
          <div v-if="postError" class="alert alert-danger mt-2" data-testid="review-post-error">{{ postError }}</div>
          <ReviewForm :logged-in="!!auth.user" :submitting="posting" @submit="post" />
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
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
  border-bottom: 1px solid #e8eaf0;
}

.detail-list > div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.detail-list dt {
  color: #6c757d;
  font-weight: 400;
}

.detail-list dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.detail-description {
  flex-direction: column;
  gap: 0.35rem !important;
}

.detail-description dd {
  text-align: left;
}

.university-heading {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.detail-logo {
  width: min(200px, 45vw);
  aspect-ratio: 1;
  max-width: 100%;
  object-fit: contain;
  background-color: white;
}

@media (max-width: 575.98px) {
  .university-header {
    margin-bottom: 1rem !important;
  }

  .detail-logo {
    width: min(160px, 45vw);
  }
}
</style>
