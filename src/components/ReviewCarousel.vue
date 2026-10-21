<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { STORAGE_URL } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { REVIEW_TOPICS, useReviewsStore } from '@/stores/reviews'
import ReviewComments from '@/components/ReviewComments.vue'

const props = defineProps({ reviews: { type: Array, default: () => [] } })

const route = useRoute()
const auth = useAuthStore()
const store = useReviewsStore()
const actionError = ref('')

// the store can still hold the previous university's reviews until the new load starts
const ready = computed(() => store.loaded && store.universityId === String(route.params.id))

const average = computed(() => {
  if (!props.reviews.length) return 0
  const total = props.reviews.reduce((sum, r) => sum + Number(r.rating), 0)
  return total / props.reviews.length
})

// Bootstrap moves the "active" class around by itself, so start the carousel
// over whenever a review is added or removed.
const carouselKey = computed(() => props.reviews.map((r) => r.id).join('-'))

function stars(n) {
  const filled = Math.round(n)
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

function topicsFor(review) {
  return REVIEW_TOPICS.filter((t) => review[t.key])
}

function imageUrl(path) {
  return `${STORAGE_URL}/review-images/${path}`
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
    <h2 class="h5">Reviews</h2>
    <p v-if="!ready && !store.error" class="text-muted" data-testid="reviews-loading">Loading reviews...</p>
    <p v-else-if="ready && !reviews.length" class="text-muted" data-testid="reviews-empty">No reviews yet. Be the first to post one.</p>
    <template v-else-if="ready">
      <p class="mb-2" data-testid="reviews-average">
        <span class="text-warning">{{ stars(average) }}</span>
        {{ average.toFixed(1) }} out of 5 from {{ reviews.length }} {{ reviews.length === 1 ? 'review' : 'reviews' }}
      </p>
      <div v-if="actionError" class="alert alert-danger" data-testid="review-action-error">{{ actionError }}</div>
      <div :key="carouselKey" id="review-carousel" class="carousel slide card card-body" data-bs-interval="false">
        <div class="carousel-inner px-4">
          <div v-for="(r, i) in reviews" :key="r.id" class="carousel-item" :class="{ active: i === 0 }" data-testid="review-item">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <span class="text-warning fs-5" :aria-label="`${r.rating} out of 5`" data-testid="review-rating">{{ stars(r.rating) }}</span>
                <small class="text-muted ms-2">
                  {{ r.user_id === auth.user?.id ? 'You' : 'SMU student' }} &middot; {{ new Date(r.created_at).toLocaleDateString() }}
                </small>
              </div>
              <button v-if="r.user_id === auth.user?.id" type="button" class="btn btn-outline-danger btn-sm" data-testid="review-delete-btn" @click="remove(r)">Delete</button>
            </div>
            <ul v-if="topicsFor(r).length" class="list-inline small text-muted my-1">
              <li v-for="t in topicsFor(r)" :key="t.key" class="list-inline-item">{{ t.label }} {{ r[t.key] }}/5</li>
            </ul>
            <blockquote class="my-2 text-break" style="white-space: pre-line" data-testid="review-body">{{ r.review }}</blockquote>
            <img v-if="r.image_path" :src="imageUrl(r.image_path)" alt="Photo shared with this review" class="img-fluid rounded mb-2" style="max-height: 16rem" data-testid="review-image" />
            <ReviewComments :review="r" />
          </div>
        </div>
        <button class="carousel-control-prev" type="button" data-bs-target="#review-carousel" data-bs-slide="prev" aria-label="Previous review" data-testid="review-prev-btn">
          <span class="carousel-control-prev-icon bg-dark rounded-circle p-2" aria-hidden="true"></span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#review-carousel" data-bs-slide="next" aria-label="Next review" data-testid="review-next-btn">
          <span class="carousel-control-next-icon bg-dark rounded-circle p-2" aria-hidden="true"></span>
        </button>
      </div>
    </template>
  </div>
</template>
