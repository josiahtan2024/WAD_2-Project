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

// State to track expanded region accordions
const expandedRegions = ref({
  'Africa': false,
  'Americas': false,
  'Asia': false,
  'Europe': false,
  'Middle-East': false,
  'Oceania': false,
  'Other': false
})

const visibleUniversities = computed(() =>
  auth.adminActive ? uni.items : uni.items.filter((university) => university.published !== false)
)

// Group universities by region and sort both regions and inner universities alphabetically
const universitiesByRegion = computed(() => {
  const grouped = {}
  
  // Initialize target regions
  TARGET_REGIONS.forEach(region => {
    grouped[region] = []
  })

  visibleUniversities.value.forEach(u => {
    const rawRegion = u.region ? u.region.trim() : ''
    // Match exact region or place in uncategorized fallback
    const matchedRegion = TARGET_REGIONS.find(
      r => r.toLowerCase() === rawRegion.toLowerCase()
    ) || 'Other'

    if (!grouped[matchedRegion]) {
      grouped[matchedRegion] = []
    }
    grouped[matchedRegion].push(u)
  })

  // Sort universities inside each region alphabetically by name
  Object.keys(grouped).forEach(region => {
    grouped[region].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  })

  // Filter out any region keys that have no items unless they are in target list
  const sortedRegions = Object.keys(grouped).sort((a, b) => a.localeCompare(b))
  
  return sortedRegions.map(regionName => ({
    name: regionName,
    universities: grouped[regionName]
  }))
})

function toggleRegion(regionName) {
  const isCurrentlyExpanded = expandedRegions.value[regionName]
  Object.keys(expandedRegions.value).forEach(key => {
    expandedRegions.value[key] = false
  })

  expandedRegions.value[regionName] = !isCurrentlyExpanded
}

function autoExpandRegionForSelected(selectedUni) {
  if (!selectedUni) return
  const rawRegion = selectedUni.region ? selectedUni.region.trim() : ''
  const matchedRegion = TARGET_REGIONS.find(
    r => r.toLowerCase() === rawRegion.toLowerCase()
  ) || 'Other'

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
  <section data-testid="home-page">
    <Notice
      :data-testid="uni.error ? 'home-error' : undefined"
      :error-message="uni.error || ''"
      @dismiss-error="uni.error = null"
    />
    
    <div class="text-center mb-4">
      <h1 class="page-title display-6 fw-bold mb-1">Plan Your SMU Exchange</h1>
    </div>

    <div class="row g-3 home-browse-row">
      <div class="col-12 col-lg-3">
        <div class="home-university-panel filter-panel">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <h2 class="h6 fw-bold mb-0 text-uppercase text-navy tracking-wider">Regions</h2>
            <span v-if="visibleUniversities.length" class="badge rounded-pill total-count-pill">
              {{ visibleUniversities.length }} Unis
            </span>
          </div>

          <div class="home-university-list-scroll pe-1">
            <div v-if="uni.loading" class="text-muted small p-2">Loading universities...</div>
            <div v-else-if="!visibleUniversities.length" class="text-muted small p-2">No partner universities found.</div>

            <div v-else class="region-accordion-group" data-testid="home-university-list">
              <div 
                v-for="regionGroup in universitiesByRegion" 
                :key="regionGroup.name" 
                class="region-card mb-2">
                <button
                  type="button"
                  class="region-header-btn w-100 d-flex align-items-center justify-content-between p-2 rounded border-0"
                  :class="{ 'is-expanded': expandedRegions[regionGroup.name] }"
                  @click="toggleRegion(regionGroup.name)"
                  :aria-expanded="!!expandedRegions[regionGroup.name]">
                  <span class="d-flex align-items-center gap-2 fw-semibold text-truncate">
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

                <div v-show="expandedRegions[regionGroup.name]" class="region-uni-container pt-1 pb-1">
                  <div v-if="!regionGroup.universities.length" class="text-muted small px-3 py-1 italic">
                    No universities listed
                  </div>
                  <ul v-else class="list-group list-group-flush rounded border-0">
                    <li 
                      v-for="u in regionGroup.universities" 
                      :key="u.id"
                      class="list-group-item list-group-item-action university-list-item py-2 px-3 fs-7"
                      :class="{ 'is-selected': selected?.id === u.id }"
                      role="button"
                      tabindex="0"
                      @click="toggleUniversity(u)"
                      @keydown.enter.prevent="toggleUniversity(u)"
                      @keydown.space.prevent="toggleUniversity(u)">
                      <div class="d-flex align-items-center justify-content-between gap-1">
                        <span class="uni-name text-truncate">{{ u.name }}</span>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <MapPanel
          :universities="visibleUniversities"
          :selected-id="selected?.id ?? null"
          @select="toggleUniversity"
          @reset="handleReset"
        />
      </div>

      <div class="col-12 col-lg-3">
        <InfoPanel :university="selected" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.total-count-pill {
  background-color: var(--app-navy);
  color: #ffffff;
  font-size: 0.7rem;
  padding: 0.3em 0.7em;
}

.home-browse-row { 
  --home-map-height: 480px; 
}

.home-university-panel {
  display: flex;
  flex-direction: column;
  height: var(--home-map-height);
  min-height: 0;
  overflow: hidden;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
}

.home-university-list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.home-browse-row :deep(.map-panel) {
  height: var(--home-map-height);
  border-radius: var(--app-radius);
}

.region-card {
  background: #ffffff;
  border: 1px solid var(--app-border);
  border-radius: 0.5rem;
  overflow: hidden;
}

.region-header-btn {
  background: #ffffff;
  color: var(--app-navy);
  font-size: 0.875rem;
  transition: background-color 0.15s ease, color 0.15s ease;
  cursor: pointer;
}

.region-header-btn:hover {
  background-color: rgba(44, 51, 102, 0.05);
}

.region-header-btn.is-expanded {
  background-color: rgba(44, 51, 102, 0.08);
  color: var(--app-blue);
}

.region-icon {
  color: var(--app-blue);
  font-size: 0.8rem;
}

.region-count-badge {
  background-color: rgba(44, 51, 102, 0.1);
  color: var(--app-navy);
  font-size: 0.7rem;
  font-weight: 700;
}

.region-chevron {
  font-size: 0.75rem;
  transition: transform 0.2s ease;
  color: var(--app-gray-blue);
}

.rotate-180 {
  transform: rotate(180deg);
}

.region-uni-container {
  max-height: 200px;
  overflow-y: auto;
  border-top: 1px solid var(--app-border);
  background-color: #ffffff;
}

.fs-7 {
  font-size: 0.825rem;
}

.fs-8 {
  font-size: 0.75rem;
}

.university-list-item {
  cursor: pointer;
  border-color: rgba(232, 234, 240, 0.6);
  color: #334155;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.university-list-item:hover {
  background-color: rgba(44, 51, 102, 0.05);
  color: var(--app-blue);
}

.university-list-item.is-selected,
.university-list-item.is-selected:hover,
.university-list-item.is-selected:focus {
  background-color: var(--app-navy);
  color: #ffffff;
  border-color: var(--app-navy);
}

.map-panel :deep(.leaflet-interactive:focus:not(:focus-visible)) {
  outline: none;
}
</style>