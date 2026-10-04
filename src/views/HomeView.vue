<script setup>
import { onMounted, ref } from 'vue'
import { useUniversitiesStore } from '@/stores/universities'
import MapPanel from '@/components/MapPanel.vue'
import InfoPanel from '@/components/InfoPanel.vue'

const uni = useUniversitiesStore()
const mode = ref('universities') // 'universities' | 'modules'
const selected = ref(null)

onMounted(async () => {
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
          <li v-for="u in uni.items" :key="u.id" class="list-group-item list-group-item-action" role="button" @click="selected = u">{{ u.name }}</li>
        </ul>
        <ul v-else class="list-group" data-testid="home-module-list">
          <li v-if="!uni.modules.length" class="list-group-item text-muted">No modules yet.</li>
          <li v-for="m in uni.modules" :key="m.id" class="list-group-item">{{ m.code }} {{ m.name }}</li>
        </ul>
      </div>
      <div class="col-12 col-md-6"><MapPanel :universities="uni.items" @select="selected = $event" /></div>
      <div class="col-12 col-md-3"><InfoPanel :university="selected" /></div>
    </div>
  </section>
</template>
