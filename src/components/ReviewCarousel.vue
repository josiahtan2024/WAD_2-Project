<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { REVIEW_TOPICS, reviewImageUrl, useReviewsStore } from '@/stores/reviews'
import ReviewComments from '@/components/ReviewComments.vue'
import ReviewForm from '@/components/ReviewForm.vue'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue'

const props = defineProps({ reviews: { type: Array, default: () => [] } })
const emit = defineEmits(['success'])

const route = useRoute()
const auth = useAuthStore()
const store = useReviewsStore()
const editingId = ref(null)
const actionError = ref('')
const pendingRemoval = ref(null)
const removingReview = ref(false)
const activeIndex = ref(0)
const carouselElement = ref(null)

watch(
  () => pendingRemoval.value,
  (newVal) => {
    if (newVal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true }
)
onUnmounted(() => {
  document.body.style.overflow = ''
})

// Load here so the reviews show up whichever page mounts this, and reload when the
// route changes to another university. A failure ends up in store.error.
watch(
  () => route.params.id,
  (id) => store.load(id).catch(() => {}),
  { immediate: true }
)

const ready = computed(() => store.isLoadedFor(route.params.id))

const average = computed(() => {
  if (!props.reviews.length) return 0
  const total = props.reviews.reduce((sum, r) => sum + Number(r.rating), 0)
  return total / props.reviews.length
})

// Bootstrap moves the "active" class around by itself, so start the carousel
// over whenever a review is added or removed.
const carouselKey = computed(() => props.reviews.map((r) => r.id).join('-'))
function updateActiveReview(event) {
  activeIndex.value = event.to
}

function bindCarouselListener() {
  carouselElement.value?.removeEventListener('slid.bs.carousel', updateActiveReview)
  carouselElement.value?.addEventListener('slid.bs.carousel', updateActiveReview)
}

watch(carouselKey, async () => {
  activeIndex.value = 0
  await nextTick()
  bindCarouselListener()
})

onMounted(bindCarouselListener)
onBeforeUnmount(() => {
  carouselElement.value?.removeEventListener('slid.bs.carousel', updateActiveReview)
})

function isMine(review) {
  return review.user_id === auth.user?.id
}

// updated_at starts out equal to created_at, so only a real gap means it was edited
function wasEdited(review) {
  return !!review.updated_at && new Date(review.updated_at) - new Date(review.created_at) > 1000
}

function stars(n) {
  const filled = Math.round(n)
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

function topicsFor(review) {
  return REVIEW_TOPICS.filter((t) => review[t.key])
}

// an admin can remove any review, and says so, so nobody mistakes it for their own
function remove(review) {
  pendingRemoval.value = review
}

async function confirmRemoval() {
  if (!pendingRemoval.value || removingReview.value) return
  actionError.value = ''
  removingReview.value = true
  const deletingOwnReview = isMine(pendingRemoval.value)
  try {
    await store.remove(pendingRemoval.value.id)
    pendingRemoval.value = null
    emit(
      'success',
      deletingOwnReview
        ? 'Your review was deleted successfully.'
        : 'The review was removed successfully.'
    )
  } catch (e) {
    actionError.value = e.message
    pendingRemoval.value = null
  } finally {
    removingReview.value = false
  }
}

const removalIsMine = computed(() => (pendingRemoval.value ? isMine(pendingRemoval.value) : false))
const removalTitle = computed(() =>
  removalIsMine.value ? 'Delete Review?' : 'Remove Student Review?'
)
</script>

<template>
  <div data-testid="review-carousel">
    <DeleteConfirmDialog
      :open="!!pendingRemoval"
      :title="removalTitle"
      :action-label="'Delete'"
      :working-label="'Deleting...'"
      :working="removingReview"
      @cancel="pendingRemoval = null"
      @confirm="confirmRemoval"
    >
      <template #description>
        <span v-if="removalIsMine">
          Are you sure you want to delete your review?
          <br>This action cannot be undone.
        </span>
        <span v-else>
          This review will be removed and the student will not be notified.
          <br>This action cannot be undone.          
        </span>
      </template>
    </DeleteConfirmDialog>
    <h2 class="h5 fw-bold text-navy mb-1">Reviews</h2>
    <p v-if="!ready && !store.error" class="text-muted small" data-testid="reviews-loading">
      <span class="spinner-border spinner-border-sm me-1 text-primary"></span> Loading reviews...
    </p>
    <p v-else-if="ready && !reviews.length" class="text-muted small mb-0" data-testid="reviews-empty">
      No reviews yet. Be the first to post one.
    </p>
    <template v-else-if="ready">
      <p class="mb-3 small text-muted" data-testid="reviews-average">
        <span class="text-warning me-1 fs-6">{{ stars(average) }}</span>
        <strong class="text-navy">{{ average.toFixed(1) }}</strong> out of 5 from {{ reviews.length }}
        {{ reviews.length === 1 ? 'review' : 'reviews' }}
      </p>
      <div v-if="actionError" class="alert alert-danger rounded-4 py-2 small" data-testid="review-action-error">
        {{ actionError }}
      </div>
      <div
        :key="carouselKey"
        ref="carouselElement"
        id="review-carousel"
        class="carousel slide"
        data-bs-interval="false"
      >
        <div class="carousel-inner px-1">
          <div
            v-for="(r, i) in reviews"
            :key="r.id"
            class="carousel-item"
            :class="{ active: i === 0 }"
            data-testid="review-item"
          >
            <div class="p-4 bg-light rounded-4 border">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <span
                    class="text-warning fs-5 me-2"
                    :aria-label="`${r.rating} out of 5`"
                    data-testid="review-rating"
                    >{{ stars(r.rating) }}</span
                  >
                  <small class="text-muted">
                    <i class="bi bi-person-circle me-1"></i>{{ isMine(r) ? 'You' : 'SMU student' }} &middot;
                    {{ new Date(r.created_at).toLocaleDateString() }}
                    <span v-if="wasEdited(r)" data-testid="review-edited" class="fst-italic">(edited)</span>
                  </small>
                </div>
                <button
                  v-if="!isMine(r) && auth.adminActive"
                  type="button"
                  class="btn btn-outline-danger btn-sm rounded-pill px-3"
                  data-testid="review-remove-btn"
                  @click="remove(r)"
                >
                  Remove
                </button>
                <div v-if="isMine(r)" class="d-flex gap-1">
                  <button
                    v-if="editingId !== r.id"
                    type="button"
                    class="btn btn-outline-secondary btn-sm rounded-pill px-3"
                    data-testid="review-edit-btn"
                    @click="editingId = r.id"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm rounded-circle p-2 lh-1"
                    data-testid="review-delete-btn"
                    @click="remove(r)"
                    title="Delete review"
                    aria-label="Delete review"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
              <ReviewForm
                v-if="editingId === r.id"
                :review="r"
                logged-in
                @saved="editingId = null"
                @success="emit('success', $event)"
                @cancel="editingId = null"
              />
              <template v-else>
                <div v-if="topicsFor(r).length" class="d-flex flex-wrap gap-1 my-2">
                  <span v-for="t in topicsFor(r)" :key="t.key" class="badge bg-white text-secondary border fw-normal">
                    {{ t.label }}: <strong class="text-navy">{{ r[t.key] }}/5</strong>
                  </span>
                </div>
                <blockquote
                  class="my-3 text-navy text-break fs-7 border-start border-3 border-primary ps-3"
                  style="white-space: pre-line"
                  data-testid="review-body"
                >
                  {{ r.review }}
                </blockquote>
                <img
                  v-if="r.image_path"
                  :src="reviewImageUrl(r.image_path)"
                  alt="Photo shared with this review"
                  class="img-fluid rounded-3 border mb-3"
                  style="max-height: 16rem; object-fit: cover;"
                  data-testid="review-image"
                />
              </template>
              <ReviewComments :review="r" />
            </div>
          </div>
        </div>
        <nav
          v-if="reviews.length > 1"
          class="review-pagination d-flex justify-content-center align-items-center gap-3 mt-3"
          aria-label="Review pages"
        >
          <button
            class="btn btn-outline-secondary btn-sm rounded-circle p-2 lh-1"
            type="button"
            data-bs-target="#review-carousel"
            data-bs-slide="prev"
            aria-label="Previous Review"
            data-testid="review-prev-btn"
          >
            <i class="bi bi-chevron-left" aria-hidden="true"></i>
            <span class="visually-hidden">Previous Review</span>
          </button>
          <span class="small fw-semibold text-navy" aria-live="polite"
            >{{ activeIndex + 1 }} / {{ reviews.length }}</span
          >
          <button
            class="btn btn-outline-secondary btn-sm rounded-circle p-2 lh-1"
            type="button"
            data-bs-target="#review-carousel"
            data-bs-slide="next"
            aria-label="Next Review"
            data-testid="review-next-btn"
          >
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
            <span class="visually-hidden">Next Review</span>
          </button>
        </nav>
      </div>
    </template>
  </div>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.fs-7 {
  font-size: 0.875rem;
}

.carousel-item {
  transition: transform 0.3s ease-in-out;
}
</style>