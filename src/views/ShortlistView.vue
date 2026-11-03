<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useShortlistStore } from '@/stores/shortlist'
import { useUniversitiesStore } from '@/stores/universities'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import Notice from '@/components/AppNotice.vue'

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
  <section class="container py-4 mb-5" data-testid="shortlist-page">
    <Notice
      :data-testid="shortlist.error || pageError ? 'shortlist-error' : undefined"
      :error-message="errorMessage || shortlist.error || pageError"
      :success-message="successMessage"
      @dismiss-error="errorMessage = ''; shortlist.error = null; pageError = ''"
      @dismiss-success="successMessage = ''"
    />

    <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 pb-3 mb-4 border-bottom">
      <div>
        <h1 class="page-title h3 fw-bold mb-1 text-navy">My Shortlist</h1>
        <p class="text-muted small mb-0">Manage your saved partner universities.</p>
      </div>

      <div class="d-flex align-items-center gap-2">
        <label for="shortlist-sort" class="visually-hidden">
          Sort Shortlist
        </label>
        <select
          id="shortlist-sort"
          v-model="sortBy"
          class="form-select form-select-sm shortlist-sort"
        >
          <option value="added">Recently Added</option>
          <option value="name">University Name (A - Z)</option>
          <option value="country">Country (A - Z)</option>
        </select>
      </div>
    </div>

    <div
      v-if="pageLoading || shortlist.loading"
      class="text-muted text-center py-5"
      data-testid="shortlist-loading"
    >
      <div class="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
      Loading shortlist...
    </div>

    <div
      v-else-if="!saved.length && !pageError"
      class="text-center py-5 px-3 bg-light rounded-4 border border-dashed my-4"
      data-testid="shortlist-empty"
    >
      <div class="mb-3">
        <i class="bi bi-bookmark-heart fs-1 text-muted"></i>
      </div>
      <h3 class="h5 fw-semibold text-navy mb-2">Nothing shortlisted yet</h3>
      <p class="text-muted small mb-3">Explore our global network of partner universities and save your favorites here.</p>
      <RouterLink to="/" class="btn btn-primary px-4 rounded-pill">Browse Partner Universities</RouterLink>
    </div>

    <div
      v-else-if="saved.length"
      class="d-flex flex-column gap-3"
      data-testid="shortlist-list"
    >
      <div
        v-for="u in paginatedSaved"
        :key="u.id"
        class="list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between p-3 p-md-4 bg-white border rounded-4 shortlist-row-item"
        data-testid="shortlist-item"
      >
        <div class="d-flex align-items-center gap-3 mb-3 mb-md-0 min-width-0">
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
              class="bi bi-mortarboard fs-4 text-muted"
              aria-hidden="true"
            ></i>
          </div>
          <div class="min-width-0">
            <h3 class="shortlist-name text-navy mb-1 text-truncate">{{ u.name }}</h3>
            <p class="text-muted small mb-0 text-truncate">
              <i class="bi bi-geo-alt text-primary me-1"></i>{{ u.city }}, {{ u.country }}
            </p>
          </div>
        </div>

        <div class="d-flex align-items-center gap-2 ms-md-auto flex-wrap flex-shrink-0">
          <RouterLink
            :to="`/schedule/${u.id}`"
            class="btn btn-sm btn-primary rounded-pill px-3 py-2"
            data-testid="shortlist-schedule-link"
          >
            <i class="bi bi-calendar-check me-1"></i> Plan Schedule
          </RouterLink>

          <RouterLink
            :to="`/universities/${u.id}`"
            class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-2"
          >
            Details
          </RouterLink>

          <button
            class="btn btn-sm btn-outline-danger rounded-circle p-2 lh-1 remove-btn"
            data-testid="shortlist-remove-btn"
            @click="remove(u)"
            title="Remove from shortlist"
            aria-label="Remove from shortlist"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <nav
      v-if="pageCount > 1 && !pageLoading && !shortlist.loading"
      class="shortlist-pagination mt-5"
      aria-label="Shortlist pages"
      data-testid="shortlist-pagination"
    >
      <ul class="pagination justify-content-center flex-wrap mb-0">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button
            class="page-link rounded-start-pill px-3"
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
            class="page-link px-3"
            type="button"
            :aria-current="currentPage === page ? 'page' : undefined"
            :aria-label="`Page ${page}`"
            @click="goToPage(page)"
          >{{ page }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === pageCount }">
          <button
            class="page-link rounded-end-pill px-3"
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
.text-navy {
  color: var(--app-navy);
}

.shortlist-row-item {
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.shortlist-row-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.05) !important;
  border-color: rgba(44, 51, 102, 0.2) !important;
}

.shortlist-logo-box {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: #ffffff;
}

.shortlist-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.shortlist-name {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.35;
}

.remove-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shortlist-sort {
  width: 200px;
}

.border-dashed {
  border-style: dashed !important;
}

.shortlist-pagination .page-link {
  color: var(--app-blue);
  border-color: var(--app-border);
  background-color: #fff;
}

.shortlist-pagination .page-link:hover:not(:disabled) {
  color: var(--app-blue);
  border-color: var(--app-border);
  background-color: var(--app-surface);
}

.shortlist-pagination .page-item.active .page-link {
  color: #fff;
  border-color: var(--app-blue);
  background-color: var(--app-blue);
}

.shortlist-pagination .page-item.disabled .page-link {
  color: #8793a6;
  background-color: var(--app-surface);
}
</style>
