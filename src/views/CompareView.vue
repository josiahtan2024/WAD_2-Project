<script setup>
import { computed, onMounted } from 'vue'
import { useShortlistStore } from '@/stores/shortlist'
import { useUniversitiesStore } from '@/stores/universities'
import CompareTable from '@/components/CompareTable.vue'

const shortlist = useShortlistStore()
const uni = useUniversitiesStore()

const saved = computed(() =>
  shortlist.items.map((s) => uni.items.find((u) => u.id === s.university_id)).filter(Boolean),
)

async function remove(u) {
  try {
    await shortlist.remove(u.id)
  } catch (e) {
    shortlist.error = e.message
  }
}

onMounted(async () => {
  try {
    if (!uni.items.length) await uni.load()
    await shortlist.load()
  } catch (e) {
    shortlist.error = e.message
  }
})
</script>

<template>
  <section data-testid="compare-page">
    <h1 class="h3 mb-3">Compare</h1>
    <div v-if="shortlist.loading" class="text-muted" data-testid="compare-loading">Loading...</div>
    <div v-else-if="shortlist.error" class="alert alert-danger" data-testid="compare-error">{{ shortlist.error }}</div>
    <p v-else-if="!saved.length" class="text-muted" data-testid="compare-empty">
      Shortlist some universities to compare them. <RouterLink to="/universities">Browse universities</RouterLink>.
    </p>
    <CompareTable v-else :universities="saved" @remove="remove" />
  </section>
</template>
