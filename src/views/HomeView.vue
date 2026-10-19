<script setup>
import { onMounted, ref } from 'vue'
import { useUniversitiesStore } from '@/stores/universities'
import MapPanel from '@/components/MapPanel.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import { useExchangeRatesStore } from '@/stores/exchangeRates'

const exchangeRates = useExchangeRatesStore()

const uni = useUniversitiesStore()
const mode = ref('universities') // 'universities' | 'modules'
const selected = ref(null)

function toggleUniversity(university) {
  selected.value =
    selected.value?.id === university.id
      ? null
      : university
}

onMounted(async () => {
  exchangeRates.load()
  try {
    await uni.load()
    await uni.loadModules()
  } catch (e) {
    uni.error = e.message
  }
})
</script>

<template>
  <section data-testid="home-page">
    <h1 class="h3 mb-3">Plan your SMU exchange</h1>
    <div v-if="uni.error" class="alert alert-warning" data-testid="home-error">{{ uni.error }}</div>
    <div class="row g-3">
      <div class="col-12 col-md-3">
        <div class="btn-group w-100 mb-2" role="group" aria-label="List mode">
          <button class="btn btn-sm" :class="mode === 'modules' ? 'btn-primary' : 'btn-outline-primary'" data-testid="home-modules-toggle" @click="mode = 'modules'">Modules</button>
          <button class="btn btn-sm" :class="mode === 'universities' ? 'btn-primary' : 'btn-outline-primary'" data-testid="home-universities-toggle" @click="mode = 'universities'">Universities</button>
        </div>
        <div v-if="uni.loading" class="text-muted">Loading...</div>
        <ul v-else-if="mode === 'universities'" class="list-group" data-testid="home-university-list">
          <li v-if="!uni.items.length" class="list-group-item text-muted">No universities yet.</li>
          <li v-for="u in uni.items":key="u.id"
              class="list-group-item list-group-item-action university-list-item"
              :class="{ 'is-selected': selected?.id === u.id }"
              role="button"
              tabindex="0"
              @click="toggleUniversity(u)"
              @keydown.enter.prevent="toggleUniversity(u)"
              @keydown.space.prevent="toggleUniversity(u)">{{ u.name }}</li>
        </ul>
        <ul v-else class="list-group" data-testid="home-module-list">
          <li v-if="!uni.modules.length" class="list-group-item text-muted">No modules yet.</li>
          <li v-for="m in uni.modules" :key="m.id" class="list-group-item">{{ m.code }} {{ m.name }}</li>
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