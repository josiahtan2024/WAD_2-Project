<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import { useShortlistStore } from '@/stores/shortlist'
import { useAuthStore } from '@/stores/auth'
import FilterBar from '@/components/FilterBar.vue'
import UniversityCard from '@/components/UniversityCard.vue'

const uni = useUniversitiesStore()
const shortlist = useShortlistStore()
const auth = useAuthStore()
const router = useRouter()

// Until the student-owned filter helpers exist, show the unfiltered list instead of crashing.
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
    return matchesKeyword && matchesRegion
  })

  return filtered.sort((a, b) => {
    if (uni.sortBy === 'country') return a.country.localeCompare(b.country)
    if (uni.sortBy === 'cost') {
      const costA = a.region_band_min == null ? Infinity : Number(a.region_band_min)
      const costB = b.region_band_min == null ? Infinity : Number(b.region_band_min)

      if(costA < costB) return -1
      if(costA > costB) return 1
    }
    return a.name.localeCompare(b.name)
  })

})
const regions = computed(() => Array.from(new Set(uni.items.map((u) => u.region))).sort())
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
  <section data-testid="universities-page">
    <h1 class="h3 mb-3">Universities</h1>
    <FilterBar v-model:query="uni.query" v-model:region="uni.filters.region" v-model:sort-by="uni.sortBy" :regions="regions" />

    <div v-if="shortlist.error" class="alert alert-warning" data-testid="shortlist-error">{{ shortlist.error }}</div>
    <div v-if="uni.loading" class="text-muted" data-testid="universities-loading">Loading universities...</div>
    <div v-else-if="uni.error" class="alert alert-danger" data-testid="universities-error">Could not load universities: {{ uni.error }}</div>
    <p v-else-if="!results.length" class="text-muted" data-testid="universities-empty">No universities match your search.</p>
    <div v-else class="row g-3" data-testid="universities-grid">
      <div v-for="u in results" :key="u.id" class="col-12 col-sm-6 col-lg-4">
        <UniversityCard :university="u" :shortlisted="isShortlisted(u.id)" @toggle-shortlist="toggle" />
      </div>
    </div>
  </section>
</template>
