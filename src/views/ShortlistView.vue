<script setup>
import { computed, onMounted } from 'vue'
import { useShortlistStore } from '@/stores/shortlist'
import { useUniversitiesStore } from '@/stores/universities'

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
  <section data-testid="shortlist-page">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h3 mb-0">Your shortlist</h1>
      <RouterLink v-if="saved.length > 1" to="/compare" class="btn btn-primary btn-sm" data-testid="shortlist-compare-link">Compare</RouterLink>
    </div>
    <div v-if="shortlist.loading" class="text-muted" data-testid="shortlist-loading">Loading shortlist...</div>
    <div v-else-if="shortlist.error" class="alert alert-danger" data-testid="shortlist-error">{{ shortlist.error }}</div>
    <p v-else-if="!saved.length" class="text-muted" data-testid="shortlist-empty">
      Nothing shortlisted yet. <RouterLink to="/universities">Browse universities</RouterLink>.
    </p>
    <ul v-else class="list-group" data-testid="shortlist-list">
      <li v-for="u in saved" :key="u.id" class="list-group-item d-flex flex-wrap gap-2 justify-content-between align-items-center" data-testid="shortlist-item">
        <div>
          <strong>{{ u.name }}</strong>
          <div class="text-muted small">{{ u.city }}, {{ u.country }}</div>
        </div>
        <div class="d-flex gap-2">
          <RouterLink :to="`/schedule/${u.id}`" class="btn btn-outline-primary btn-sm" data-testid="shortlist-schedule-link">Plan schedule</RouterLink>
          <RouterLink :to="`/universities/${u.id}`" class="btn btn-outline-primary btn-sm">Details</RouterLink>
          <button class="btn btn-outline-secondary btn-sm" data-testid="shortlist-remove-btn" @click="remove(u)">Remove</button>
        </div>
      </li>
    </ul>
  </section>
</template>
