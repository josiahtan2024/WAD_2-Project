<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { REVIEW_TOPICS, reviewImageUrl, useReviewsStore } from '@/stores/reviews'
import ReviewComments from '@/components/ReviewComments.vue'
import ReviewForm from '@/components/ReviewForm.vue'

const props = defineProps({ reviews: { type: Array, default: () => [] } })

const route = useRoute()
const auth = useAuthStore()
const store = useReviewsStore()
const editingId = ref(null)
const actionError = ref('')
const activeIndex = ref(0)
const carouselElement = ref(null)

// Load here so the reviews show up whichever page mounts this, and reload when the
// route changes to another university. A failure ends up in store.error.
watch(
  () => route.params.id,
  (id) => store.load(id).catch(() => {}),
  { immediate: true },
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

async function remove(review) {
  if (!confirm('Delete your review?')) return
  actionError.value = ''
  try {
    await store.remove(review.id)
  } catch (e) {
    actionError.value = e.message
  }
}
</script>

<template>
  <div data-testid="review-carousel">
    <h2 class="h5 fw-bold">Reviews</h2>
    <p v-if="!ready && !store.error" class="text-muted" data-testid="reviews-loading">Loading reviews...</p>
    <p v-else-if="ready && !reviews.length" class="text-muted" data-testid="reviews-empty">No reviews yet. Be the first to post one.</p>
    <template v-else-if="ready">
      <p class="mb-2" data-testid="reviews-average">
        <span class="text-warning">{{ stars(average) }}</span>
        {{ average.toFixed(1) }} out of 5 from {{ reviews.length }} {{ reviews.length === 1 ? 'review' : 'reviews' }}
      </p>
      <div v-if="actionError" class="alert alert-danger" data-testid="review-action-error">{{ actionError }}</div>
      <div :key="carouselKey" ref="carouselElement" id="review-carousel" class="carousel slide card border-0 shadow-sm rounded-4" data-bs-interval="false">
        <div class="card-body p-3 p-md-4">
        <div class="carousel-inner px-4">
          <div v-for="(r, i) in reviews" :key="r.id" class="carousel-item" :class="{ active: i === 0 }" data-testid="review-item">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <span class="text-warning fs-5" :aria-label="`${r.rating} out of 5`" data-testid="review-rating">{{ stars(r.rating) }}</span>
                <small class="text-muted ms-2">
                  {{ isMine(r) ? 'You' : 'SMU student' }} &middot; {{ new Date(r.created_at).toLocaleDateString() }}
                  <span v-if="wasEdited(r)" data-testid="review-edited">(edited)</span>
                </small>
              </div>
              <div v-if="isMine(r)" class="d-flex gap-1">
                <button v-if="editingId !== r.id" type="button" class="btn btn-outline-secondary btn-sm" data-testid="review-edit-btn" @click="editingId = r.id">Edit</button>
                <button type="button" class="btn btn-outline-danger btn-sm" data-testid="review-delete-btn" @click="remove(r)">Delete</button>
              </div>
            </div>
            <ReviewForm v-if="editingId === r.id" :review="r" logged-in @saved="editingId = null" @cancel="editingId = null" />
            <template v-else>
              <ul v-if="topicsFor(r).length" class="list-inline small text-muted my-1">
                <li v-for="t in topicsFor(r)" :key="t.key" class="list-inline-item">{{ t.label }} {{ r[t.key] }}/5</li>
              </ul>
              <blockquote class="my-2 text-break" style="white-space: pre-line" data-testid="review-body">{{ r.review }}</blockquote>
              <img v-if="r.image_path" :src="reviewImageUrl(r.image_path)" alt="Photo shared with this review" class="img-fluid rounded mb-2" style="max-height: 16rem" data-testid="review-image" />
            </template>
            <ReviewComments :review="r" />
          </div>
        </div>
        <nav v-if="reviews.length > 1" class="review-pagination d-flex justify-content-center align-items-center gap-3 mt-3" aria-label="Review pages">
          <button class="btn btn-outline-secondary btn-sm" type="button" data-bs-target="#review-carousel" data-bs-slide="prev" aria-label="Previous review" data-testid="review-prev-btn">
            <i class="bi bi-arrow-left" aria-hidden="true"></i>
            <span class="visually-hidden">Previous review</span>
          </button>
          <span class="small text-secondary" aria-live="polite">{{ activeIndex + 1 }} / {{ reviews.length }}</span>
          <button class="btn btn-outline-secondary btn-sm" type="button" data-bs-target="#review-carousel" data-bs-slide="next" aria-label="Next review" data-testid="review-next-btn">
            <i class="bi bi-arrow-right" aria-hidden="true"></i>
            <span class="visually-hidden">Next review</span>
          </button>
        </nav>
        </div>
      </div>
    </template>
  </div>
</template>
