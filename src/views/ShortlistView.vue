<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useShortlistStore } from '@/stores/shortlist'
import { useUniversitiesStore } from '@/stores/universities'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import BudgetNotice from '@/components/BudgetNotice.vue'

const pageLoading = ref(true)
const pageError = ref('')
const errorMessage = ref('')
const successMessage = ref('')

let noticeTimeout = null
watch([errorMessage, successMessage], ([error, success]) => {
  if (noticeTimeout) clearTimeout(noticeTimeout)
  if (!error && !success) return

  const errorAtSchedule = error
  const successAtSchedule = success
  noticeTimeout = setTimeout(() => {
    if (errorMessage.value === errorAtSchedule) errorMessage.value = ''
    if (successMessage.value === successAtSchedule) successMessage.value = ''
    noticeTimeout = null
  }, 5000)
})

onUnmounted(() => {
  if (noticeTimeout) clearTimeout(noticeTimeout)
})

const shortlist = useShortlistStore()

const uni = useUniversitiesStore()
const auth = useAuthStore()

const sortBy = ref('added')
const currentPage = ref(1)
const pageSize = 6

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
    .filter((university) => auth.adminActive || university.published !== false)

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

const pageCount = computed(() => Math.ceil(saved.value.length / pageSize))
const paginatedSaved = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return saved.value.slice(start, start + pageSize)
})

watch([() => saved.value.length, sortBy], () => {
  currentPage.value = Math.min(currentPage.value, Math.max(pageCount.value, 1))
})

function goToPage(page) {
  currentPage.value = Math.min(Math.max(page, 1), pageCount.value)
}

function getLogoUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const filePath = path.replace(/^\/?university-logos\//, '')
  return supabase.storage
    .from('university-logos')
    .getPublicUrl(filePath).data.publicUrl
}

async function remove(u) {
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await shortlist.remove(u.id)
    successMessage.value = `${u.name} removed from your shortlist.`
  } catch (e) {
    errorMessage.value = e.message || 'Unable to remove this university from your shortlist.'
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
    <BudgetNotice
      :data-testid="shortlist.error || pageError ? 'shortlist-error' : undefined"
      :error-message="errorMessage || shortlist.error || pageError"
      :success-message="successMessage"
      @dismiss-error="errorMessage = ''; shortlist.error = null; pageError = ''"
      @dismiss-success="successMessage = ''"
    />
    <div class="d-flex flex-column gap-3 mb-3">
    <h1 class="page-title h3 fw-bold text-center mb-0">Your Shortlist</h1>

    <div class="d-flex justify-content-end align-items-center gap-2">
      <label for="shortlist-sort" class="visually-hidden">
        Sort Shortlist
      </label>

      <select
        id="shortlist-sort"
        v-model="sortBy"
        class="form-select form-select-sm shortlist-sort"
      >
        <option value="name">University Name (A–Z)</option>
        <option value="country">Country (A–Z)</option>
        <option value="added">Recently Added</option>
      </select>

    </div>
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
  class="text-muted text-center"
  data-testid="shortlist-empty"
>
  Nothing shortlisted yet.
  <br />
  <RouterLink to="/universities">Browse Partner Universities</RouterLink>.
</p>
<ul
  v-else-if="saved.length"
  class="list-group"
  data-testid="shortlist-list"
>
  <li
    v-for="u in paginatedSaved"
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
        Plan Schedule
      </RouterLink>

      <div class="shortlist-secondary-actions">
        <RouterLink
          :to="`/universities/${u.id}`"
          class="btn btn-outline-secondary"
        >
          Details
        </RouterLink>

        <button
          class="btn btn-outline-danger"
          data-testid="shortlist-remove-btn"
          @click="remove(u)"
        >
          Remove
        </button>
      </div>
    </div>
  </li>
</ul>

<nav
  v-if="pageCount > 1 && !pageLoading && !shortlist.loading"
  class="shortlist-pagination mt-4"
  aria-label="Shortlist pages"
  data-testid="shortlist-pagination"
>
  <ul class="pagination justify-content-center flex-wrap mb-0">
    <li class="page-item" :class="{ disabled: currentPage === 1 }">
      <button
        class="page-link"
        type="button"
        :disabled="currentPage === 1"
        aria-label="Previous page"
        @click="goToPage(currentPage - 1)"
      >Previous</button>
    </li>
    <li
      v-for="page in pageCount"
      :key="page"
      class="page-item"
      :class="{ active: currentPage === page }"
    >
      <button
        class="page-link"
        type="button"
        :aria-current="currentPage === page ? 'page' : undefined"
        :aria-label="`Page ${page}`"
        @click="goToPage(page)"
      >{{ page }}</button>
    </li>
    <li class="page-item" :class="{ disabled: currentPage === pageCount }">
      <button
        class="page-link"
        type="button"
        :disabled="currentPage === pageCount"
        aria-label="Next page"
        @click="goToPage(currentPage + 1)"
      >Next</button>
    </li>
  </ul>
</nav>


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
  flex-wrap: nowrap;
  gap: 0.5rem;
}

.shortlist-secondary-actions {
  display: flex;
  flex-wrap: nowrap;
  flex: 0 0 auto;
  gap: 0.5rem;
}

.shortlist-actions .btn {
  white-space: nowrap;
}

@media (max-width: 991.98px) {
  .shortlist-main,
  .shortlist-actions {
    flex-basis: 100%;
  }

  .shortlist-actions {
    flex-wrap: wrap;
  }

  .shortlist-actions > .btn,
  .shortlist-secondary-actions {
    flex: 1 0 100%;
  }

  .shortlist-secondary-actions {
    width: 100%;
  }

  .shortlist-secondary-actions > .btn {
    flex: 1 1 0;
  }
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

}

.shortlist-sort {
  width: 180px;
}

.shortlist-pagination .page-link {
  color: #0b2348;
  border-color: #d7deea;
  background-color: #fff;
}

.shortlist-pagination .page-link:hover:not(:disabled) {
  color: #0b2348;
  border-color: #cbdcff;
  background-color: #f1f5fc;
}

.shortlist-pagination .page-item.active .page-link {
  color: #fff;
  border-color: #0b2348;
  background-color: #0b2348;
}

.shortlist-pagination .page-link:focus-visible {
  box-shadow: 0 0 0 0.2rem rgba(31, 78, 156, 0.2);
}

.shortlist-pagination .page-item.disabled .page-link {
  color: #8793a6;
  background-color: #f8faff;
}
</style>
