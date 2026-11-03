<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import MapPanel from '@/components/MapPanel.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import { useExchangeRatesStore } from '@/stores/exchangeRates'
import { useAuthStore } from '@/stores/auth'
import Notice from '@/components/AppNotice.vue'

const exchangeRates = useExchangeRatesStore()

const uni = useUniversitiesStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const selected = ref(null)

const TARGET_REGIONS = [
  'Africa',
  'Americas',
  'Asia',
  'Europe',
  'Middle-East',
  'Oceania'
]

const expandedRegions = ref({
  'Africa': false,
  'Americas': false,
  'Asia': false,
  'Europe': false,
  'Middle-East': false,
  'Oceania': false
})

const visibleUniversities = computed(() =>
  auth.adminActive ? uni.items : uni.items.filter((university) => university.published !== false)
)

const universitiesByRegion = computed(() => {
  const grouped = {}
  
  TARGET_REGIONS.forEach(region => {
    grouped[region] = []
  })

  visibleUniversities.value.forEach(u => {
    const rawRegion = u.region ? u.region.trim() : ''
    const matchedRegion = TARGET_REGIONS.find(
      r => r.toLowerCase() === rawRegion.toLowerCase()
    )

    if (matchedRegion && grouped[matchedRegion]) {
      grouped[matchedRegion].push(u)
    }
  })

  Object.keys(grouped).forEach(region => {
    grouped[region].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  })

  const sortedRegions = Object.keys(grouped).sort((a, b) => a.localeCompare(b))
  
  return sortedRegions.map(regionName => ({
    name: regionName,
    universities: grouped[regionName]
  }))
})

const hasAnyRegionExpanded = computed(() => {
  return Object.values(expandedRegions.value).some(isExpanded => isExpanded)
})

function toggleRegion(regionName) {
  const isCurrentlyExpanded = expandedRegions.value[regionName]
  
  Object.keys(expandedRegions.value).forEach(key => {
    expandedRegions.value[key] = false
  })

  expandedRegions.value[regionName] = !isCurrentlyExpanded
}

function resetRegions() {
  Object.keys(expandedRegions.value).forEach(key => {
    expandedRegions.value[key] = false
  })
}

function autoExpandRegionForSelected(selectedUni) {
  if (!selectedUni) return
  const rawRegion = selectedUni.region ? selectedUni.region.trim() : ''
  const matchedRegion = TARGET_REGIONS.find(
    r => r.toLowerCase() === rawRegion.toLowerCase()
  )

  Object.keys(expandedRegions.value).forEach(key => {
    expandedRegions.value[key] = false
  })
  
  if (matchedRegion && expandedRegions.value[matchedRegion] !== undefined) {
    expandedRegions.value[matchedRegion] = true
  }
}

watch(
  () => [route.query.university, visibleUniversities.value],
  ([universityId]) => {
    const foundUni = universityId
      ? visibleUniversities.value.find((university) => String(university.id) === String(universityId)) ?? null
      : null

    selected.value = foundUni
    if (foundUni) {
      autoExpandRegionForSelected(foundUni)
    }
  },
  { immediate: true },
)

function toggleUniversity(university) {
  const isTargetSelected = selected.value?.id === university.id
  selected.value = isTargetSelected ? null : university

  if (!isTargetSelected && university) {
    autoExpandRegionForSelected(university)
  }
}

function handleReset() {
  selected.value = null
  if (route.query.university) {
    router.replace({ query: { ...route.query, university: undefined } })
  }
}

onMounted(async () => {
  uni.error = null
  exchangeRates.load()

  try {
    if (!uni.items.length) await uni.load()
  } catch (e) {
    uni.error = e.message
  }
})
</script>

<template>
  <section data-testid="home-page" class="remaining-height-container">
    <Notice
      :data-testid="uni.error ? 'home-error' : undefined"
      :error-message="uni.error || ''"
      @dismiss-error="uni.error = null"/>

    <div class="row g-0 h-100 flex-column-reverse flex-lg-row">
      <!-- Sidebar / Details Controls -->
      <div class="col-12 col-lg-3 d-flex flex-column sidebar-column">
        <!-- Info Panel -->
        <div class="info-panel-wrapper overflow-hidden border-bottom border-end-lg">
          <InfoPanel :university="selected" class="h-100 w-100" />
        </div>
        
        <!-- Regions Panel -->
        <div class="d-flex flex-column border-end-lg p-3 home-university-panel flex-grow-1 overflow-hidden">
          <div class="d-flex align-items-center justify-content-between mb-3 px-1">
            <h2 class="region-panel-title mb-0">
              <span @click="resetRegions" role="button" tabindex="0"
                @keydown.enter.prevent="resetRegions"
                @keydown.space.prevent="resetRegions"
                style="cursor: pointer;">
                Regions
              </span>
            </h2>
            <span v-if="visibleUniversities.length" class="badge rounded-pill total-count-pill">
              {{ visibleUniversities.length }} Unis
            </span>
          </div>

          <div class="home-university-list-scroll flex-grow-1 overflow-auto pe-1">
            <div v-if="uni.loading" class="text-muted small p-3 text-center">
              <span class="spinner-border spinner-border-sm me-2 text-primary" role="status"></span>
              Loading universities...
            </div>
            <div v-else-if="!visibleUniversities.length" class="text-muted small p-3 text-center">
              No partner universities found.
            </div>

            <div v-else class="d-flex flex-column gap-2" data-testid="home-university-list">
              <template v-for="regionGroup in universitiesByRegion" :key="regionGroup.name">
                <div 
                  v-if="!hasAnyRegionExpanded || expandedRegions[regionGroup.name]" 
                  class="region-card"
                >
                  <button
                    type="button"
                    class="region-header-btn w-100 d-flex align-items-center justify-content-between border-0"
                    :class="{ 'is-expanded': expandedRegions[regionGroup.name] }"
                    @click="toggleRegion(regionGroup.name)"
                    :aria-expanded="!!expandedRegions[regionGroup.name]">
                    <span class="d-flex align-items-center gap-2 fw-semibold text-truncate text-navy">
                      <i class="bi bi-geo-alt-fill region-icon"></i>
                      {{ regionGroup.name }}
                    </span>
                    <div class="d-flex align-items-center gap-2">
                      <span class="badge region-count-badge">
                        {{ regionGroup.universities.length }}
                      </span>
                      <i 
                        class="bi bi-chevron-down region-chevron" 
                        :class="{ 'rotate-180': expandedRegions[regionGroup.name] }"
                      ></i>
                    </div>
                  </button>

                  <div v-show="expandedRegions[regionGroup.name]" class="region-uni-container py-1">
                    <div v-if="!regionGroup.universities.length" class="text-muted small px-3 py-2 fst-italic">
                      No universities listed
                    </div>
                    <ul v-else class="list-group list-group-flush rounded-0 border-0">
                      <li 
                        v-for="u in regionGroup.universities" 
                        :key="u.id"
                        class="list-group-item list-group-item-action university-list-item py-2 px-3 fs-7 border-0"
                        :class="{ 'is-selected': selected?.id === u.id }"
                        role="button"
                        tabindex="0"
                        @click="toggleUniversity(u)"
                        @keydown.enter.prevent="toggleUniversity(u)"
                        @keydown.space.prevent="toggleUniversity(u)">
                        <div class="d-flex align-items-center justify-content-between gap-2">
                          <span class="uni-name text-truncate fw-medium">{{ u.name }}</span>
                          <i v-if="selected?.id === u.id" class="bi bi-check2 text-white fs-7 flex-shrink-0"></i>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Map Column -->
      <div class="col-12 col-lg-9 map-column">
        <MapPanel
          class="h-100 w-100"
          :universities="visibleUniversities"
          :selected-id="selected?.id ?? null"
          @select="toggleUniversity"
          @reset="handleReset"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.remaining-height-container {
  min-height: 550px;
}

@media (min-width: 992px) {
  .remaining-height-container {
    height: calc(100vh - var(--app-navbar-height, 58px));
  }
  .sidebar-column {
    height: 100%;
  }
  .info-panel-wrapper {
    height: 275px !important;
    min-height: 275px !important;
    max-height: 275px !important;
    flex-shrink: 0;
  }
  .home-university-panel {
    height: auto !important;
  }
  .map-column {
    height: 100%;
  }
  .border-end-lg {
    border-right: 1px solid var(--app-border) !important;
  }
}

@media (max-width: 991.98px) {
  .remaining-height-container {
    height: auto;
  }
  .map-column {
    height: 45vh;
    min-height: 320px;
  }
  .info-panel-wrapper {
    min-height: 180px;
  }
  .home-university-panel {
    height: 370px !important;
    max-height: 370px !important;
  }
}

.sidebar-column {
  background: var(--app-surface);
}

.info-panel-wrapper {
  background: #ffffff;
}

.text-navy {
  color: var(--app-navy);
}

.region-panel-title {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--app-navy);
}

.total-count-pill {
  background-color: var(--app-blue);
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.35em 0.75em;
  letter-spacing: 0.02em;
}

.home-university-panel {
  background: var(--app-surface);
}

.home-university-list-scroll {
  overscroll-behavior: contain;
}

.home-university-list-scroll::-webkit-scrollbar {
  width: 5px;
}

.home-university-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.home-university-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(20, 27, 77, 0.15);
  border-radius: 4px;
}

.region-card {
  background: #ffffff;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.region-card:hover {
  border-color: rgba(44, 51, 102, 0.25);
}

.region-header-btn {
  background: #ffffff;
  padding: 0.65rem 0.85rem;
  font-size: 0.875rem;
  transition: background-color 0.15s ease, color 0.15s ease;
  cursor: pointer;
}

.region-header-btn:hover {
  background-color: rgba(44, 51, 102, 0.04);
}

.region-header-btn.is-expanded {
  background-color: rgba(44, 51, 102, 0.07);
}

.region-icon {
  color: var(--app-blue);
  font-size: 0.825rem;
}

.region-count-badge {
  background-color: rgba(44, 51, 102, 0.08);
  color: var(--app-navy);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.25em 0.55em;
  border-radius: 4px;
}

.region-chevron {
  font-size: 0.75rem;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--app-gray-blue);
}

.rotate-180 {
  transform: rotate(180deg);
}

.region-uni-container {
  border-top: 1px solid var(--app-border);
  background-color: #ffffff;
  max-height: 238px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.region-uni-container::-webkit-scrollbar {
  width: 4px;
}
.region-uni-container::-webkit-scrollbar-thumb {
  background: rgba(20, 27, 77, 0.15);
  border-radius: 4px;
}

.fs-7 {
  font-size: 0.825rem;
}

.university-list-item {
  cursor: pointer;
  color: #334155;
  border-radius: 0;
  transition: background-color 0.15s ease, color 0.15s ease, padding-left 0.15s ease;
}

.university-list-item:hover {
  background-color: rgba(44, 51, 102, 0.05);
  color: var(--app-blue);
  padding-left: 1rem !important;
}

.university-list-item.is-selected,
.university-list-item.is-selected:hover,
.university-list-item.is-selected:focus {
  background-color: var(--app-blue);
  color: #ffffff;
  padding-left: 1rem !important;
}
</style>