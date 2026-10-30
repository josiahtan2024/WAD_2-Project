<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import MapPanel from '@/components/MapPanel.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import { useExchangeRatesStore } from '@/stores/exchangeRates'
import { useAuthStore } from '@/stores/auth'
import BudgetNotice from '@/components/BudgetNotice.vue'

const exchangeRates = useExchangeRatesStore()

const uni = useUniversitiesStore()
const auth = useAuthStore()
const route = useRoute()
const selected = ref(null)
const visibleUniversities = computed(() =>
  auth.adminActive ? uni.items : uni.items.filter((university) => university.published !== false)
)

watch(
  () => [route.query.university, visibleUniversities.value],
  ([universityId]) => {
    selected.value = universityId
      ? visibleUniversities.value.find((university) => String(university.id) === String(universityId)) ?? null
      : null
  },
  { immediate: true },
)

function toggleUniversity(university) {
  selected.value =
    selected.value?.id === university.id
      ? null
      : university
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
    <BudgetNotice
      :data-testid="uni.error ? 'home-error' : undefined"
      :error-message="uni.error || ''"
      @dismiss-error="uni.error = null"
    />
    <h1 class="page-title h3 fw-bold text-center mb-3">Plan Your SMU Exchange</h1>
    <div class="row g-3 home-browse-row">
      <div class="col-12 col-md-3">
        <div class="home-university-panel">
          <h2 class="h5 fw-semibold mb-2">Partner Universities</h2>
          <div class="home-university-list-scroll">
            <div v-if="uni.loading" class="text-muted">Loading...</div>
            <ul v-else class="list-group" data-testid="home-university-list">
              <li v-if="!visibleUniversities.length" class="list-group-item text-muted">No partner universities yet.</li>
              <li v-for="u in visibleUniversities" :key="u.id"
                  class="list-group-item list-group-item-action university-list-item"
                  :class="{ 'is-selected': selected?.id === u.id }"
                  role="button"
                  tabindex="0"
                  @click="toggleUniversity(u)"
                  @keydown.enter.prevent="toggleUniversity(u)"
                  @keydown.space.prevent="toggleUniversity(u)">{{ u.name }}</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6">
        <MapPanel
        :universities="visibleUniversities"
        :selected-id="selected?.id ?? null"
        @select="toggleUniversity"/></div>
      <div class="col-12 col-md-3"><InfoPanel :university="selected" /></div>
    </div>
  </section>
</template>

<style scoped>
.home-browse-row { --home-map-height: 420px; }

.home-university-panel {
  display: flex;
  flex-direction: column;
  height: var(--home-map-height);
  min-height: 0;
}

.home-university-list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: 0.375rem;
}

.home-browse-row :deep(.map-panel) {
  height: var(--home-map-height);
}

.university-list-item {
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.university-list-item.is-selected,
.university-list-item.is-selected:hover,
.university-list-item.is-selected:focus {
  background-color: #0b2348;
  color: #ffffff;
  border-color: #0b2348;
}

.map-panel :deep(.leaflet-interactive:focus:not(:focus-visible)) {
  outline: none;
}
</style>
