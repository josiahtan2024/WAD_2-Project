<script setup>
import { computed, onMounted, ref } from 'vue'
import { useShortlistStore } from '@/stores/shortlist'
import { useUniversitiesStore } from '@/stores/universities'
import { supabase } from '@/lib/supabase'

const pageLoading = ref(true)
const pageError = ref('')

const shortlist = useShortlistStore()

const uni = useUniversitiesStore()

const sortBy = ref('added')

const saved = computed(() => {
  const universities = shortlist.items
    .map((item) => {
      const university = uni.items.find(
        (u) => u.id === item.university_id
      )

      return university
        ? { ...university, shortlistId: item.id }
        : null
    })
    .filter(Boolean)

  const compareName = (a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', 'en', {
      sensitivity: 'base'
    })

  return universities.sort((a, b) => {
    if (sortBy.value === 'name') {
      return compareName(a, b)
    }

    if (sortBy.value === 'country') {
      const countryOrder = (a.country ?? '').localeCompare(
        b.country ?? '',
        'en',
        { sensitivity: 'base' }
      )

      return countryOrder || compareName(a, b)
    }
    return Number(b.shortlistId) - Number(a.shortlistId)
  })
})

function getLogoUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const filePath = path.replace(/^\/?university-logos\//, '')
  return supabase.storage
    .from('university-logos')
    .getPublicUrl(filePath).data.publicUrl
}

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
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
    <h1 class="h3 mb-0">Your shortlist</h1>

    <div class="d-flex align-items-center gap-2">
      <label for="shortlist-sort" class="visually-hidden">
        Sort shortlist
      </label>

      <select
        id="shortlist-sort"
        v-model="sortBy"
        class="form-select form-select-sm shortlist-sort"
      >
        <option value="name">Name</option>
        <option value="country">Country</option>
        <option value="added">Recently added</option>
      </select>

      <RouterLink
        v-if="saved.length > 1"
        to="/compare"
        class="btn btn-primary btn-sm"
        data-testid="shortlist-compare-link"
      >Compare</RouterLink>
    </div>
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
<ul
  v-else-if="saved.length"
  class="list-group"
  data-testid="shortlist-list"
>
  <li
    v-for="u in saved"
    :key="u.id"
    class="list-group-item shortlist-row"
    data-testid="shortlist-item"
  >
    <div class="shortlist-main">
      <div class="shortlist-logo-box">
        <img
          v-if="u.logo_url"
          :src="getLogoUrl(u.logo_url)"
          :alt="`${u.name} logo`"
          class="shortlist-logo"
          loading="lazy"
        />
        <i
          v-else
          class="bi bi-mortarboard fs-2 text-muted"
          aria-hidden="true"
        ></i>
      </div>

      <div class="shortlist-info">
        <div class="shortlist-name">{{ u.name }}</div>
        <div class="shortlist-location text-muted">
          {{ u.city }}, {{ u.country }}
        </div>
      </div>
    </div>
    <div class="shortlist-actions">
      <RouterLink
        :to="`/schedule/${u.id}`"
        class="btn btn-outline-primary"
        data-testid="shortlist-schedule-link"
      >
        Plan schedule
      </RouterLink>

      <RouterLink
        :to="`/universities/${u.id}`"
        class="btn btn-outline-primary"
      >
        Details
      </RouterLink>

      <button
        class="btn btn-outline-secondary"
        data-testid="shortlist-remove-btn"
        @click="remove(u)"
      >
        Remove
      </button>
    </div>
  </li>
</ul>


  </section>
</template>

<style scoped>
.shortlist-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.25rem;
  min-height: 140px;
  padding: 1.5rem;
}

.shortlist-main {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex: 1 1 300px;
  min-width: 0;
}

.shortlist-logo-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  padding: 6px;
  background: white;
  border: 1px solid var(--bs-border-color);
  border-radius: 12px;
}

.shortlist-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.shortlist-info {
  min-width: 0;
}

.shortlist-name {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.shortlist-location {
  margin-top: 0.4rem;
  font-size: 1rem;
}

.shortlist-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (max-width: 575.98px) {
  .shortlist-row {
    padding: 1rem;
  }

  .shortlist-main {
    flex-basis: 100%;
    gap: 0.875rem;
  }

  .shortlist-logo-box {
    width: 64px;
    height: 64px;
  }

  .shortlist-name {
    font-size: 1.1rem;
  }

  .shortlist-actions {
    width: 100%;
  }
}

.shortlist-sort {
  width: 180px;
}
</style>