<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import MapPanel from '@/components/MapPanel.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import { useExchangeRatesStore } from '@/stores/exchangeRates'

const exchangeRates = useExchangeRatesStore()

const uni = useUniversitiesStore()
const route = useRoute()
const selected = ref(null)

watch(
  () => [route.query.university, uni.items],
  ([universityId]) => {
    selected.value = universityId
      ? uni.items.find((university) => String(university.id) === String(universityId)) ?? null
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
    <h1 class="h3 fw-bold text-center mb-3">Plan Your SMU Exchange</h1>
    <div v-if="uni.error" class="alert alert-warning" data-testid="home-error">{{ uni.error }}</div>
    <div class="row g-3">
      <div class="col-12 col-md-3">
        <h2 class="h5 fw-semibold mb-2">Partner Universities</h2>
        <div v-if="uni.loading" class="text-muted">Loading...</div>
        <ul v-else class="list-group" data-testid="home-university-list">
          <li v-if="!uni.items.length" class="list-group-item text-muted">No partner universities yet.</li>


          <li v-for="u in uni.items" :key="u.id"
              class="list-group-item list-group-item-action university-list-item"
              :class="{ 'is-selected': selected?.id === u.id }"
              role="button"
              tabindex="0"
              @click="toggleUniversity(u)"
              @keydown.enter.prevent="toggleUniversity(u)"
              @keydown.space.prevent="toggleUniversity(u)">{{ u.name }}</li>
        </ul>
      </div>
      <div class="col-12 col-md-6">
        <MapPanel
        :universities="uni.items"
        :selected-id="selected?.id ?? null"
        @select="toggleUniversity"/></div>
      <div class="col-12 col-md-3"><InfoPanel :university="selected" /></div>
    </div>
  </section>
</template>

<style scoped>
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
