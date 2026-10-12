<script setup>
import { computed, onMounted, ref } from 'vue'
import { useShortlistStore } from '@/stores/shortlist'
import { useUniversitiesStore } from '@/stores/universities'

const pageLoading = ref(true)
const pageError = ref('')

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
  pageLoading.value = true
  pageError.value = ''
  try {
    await Promise.all([
      uni.items.length ? Promise.resolve() : uni.load(),
      shortlist.load(),
    ])
  } catch (error) {
    pageError.value = error.message
  } finally {
    pageLoading.value = false
  }
})
</script>

<template>
  <section data-testid="shortlist-page">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h3 mb-0">Your shortlist</h1>
      <RouterLink v-if="saved.length > 1" to="/compare" class="btn btn-primary btn-sm" data-testid="shortlist-compare-link">Compare</RouterLink>
    </div>
<div
  v-if="shortlist.error || pageError"
  class="alert alert-danger"
  data-testid="shortlist-error"
>
  {{ shortlist.error || pageError }}
</div>

<div
  v-if="pageLoading || shortlist.loading"
  class="text-muted"
  data-testid="shortlist-loading"
>
  Loading shortlist...
</div>

<p
  v-else-if="!saved.length && !pageError"
  class="text-muted"
  data-testid="shortlist-empty"
>
  Nothing shortlisted yet.
  <RouterLink to="/universities">Browse universities</RouterLink>.
</p>

<ul v-else-if="saved.length" class="list-group" data-testid="shortlist-list">
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
