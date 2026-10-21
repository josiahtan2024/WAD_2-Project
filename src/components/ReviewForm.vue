<script setup>
import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { REVIEW_TOPICS, useReviewsStore } from '@/stores/reviews'
import StarRating from '@/components/StarRating.vue'

defineProps({
  loggedIn: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
})
// UniversityView still listens for `submit`. It is declared so Vue doesn't attach that
// handler to the <form> itself; posting happens here, through the store.
defineEmits(['submit'])

const route = useRoute()
const reviews = useReviewsStore()

const rating = ref(0)
const topics = reactive(Object.fromEntries(REVIEW_TOPICS.map((t) => [t.key, 0])))
const body = ref('')
const image = ref(null)
const imageInput = ref(null)
const error = ref('')

function pickImage(event) {
  image.value = event.target.files[0] ?? null
}

function reset() {
  rating.value = 0
  for (const t of REVIEW_TOPICS) topics[t.key] = 0
  body.value = ''
  image.value = null
  if (imageInput.value) imageInput.value.value = ''
}

async function submit() {
  if (reviews.saving) return
  error.value = ''
  const text = body.value.trim()
  if (!rating.value) {
    error.value = 'Pick an overall rating.'
    return
  }
  if (!text) {
    error.value = 'Write a few words about your exchange.'
    return
  }
  try {
    await reviews.post(route.params.id, { rating: rating.value, body: text, topics, image: image.value })
    reset()
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <form class="mt-3" data-testid="review-form" @submit.prevent="submit">
    <p v-if="!loggedIn" class="text-muted" data-testid="review-login-prompt">
      <RouterLink to="/login">Log in</RouterLink> to post a review.
    </p>
    <template v-else>
      <h3 class="h6">Write a review</h3>
      <StarRating v-model="rating" label="Overall rating" testid="review-rating" />
      <div class="row row-cols-1 row-cols-md-2 g-1 my-1">
        <div v-for="t in REVIEW_TOPICS" :key="t.key" class="col">
          <StarRating v-model="topics[t.key]" :label="t.label" :testid="`review-${t.key}`" />
        </div>
      </div>
      <label class="form-label mt-2" for="review-body">Your review</label>
      <textarea id="review-body" v-model="body" class="form-control mb-2" rows="3" maxlength="2000" required data-testid="review-body-input"></textarea>
      <label class="form-label" for="review-image">Photo (optional, JPG, PNG or WebP up to 2 MB)</label>
      <input id="review-image" ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp" class="form-control mb-2" data-testid="review-image-input" @change="pickImage" />
      <div v-if="error" class="alert alert-danger py-2" data-testid="review-form-error">{{ error }}</div>
      <button class="btn btn-primary" :disabled="submitting || reviews.saving" data-testid="review-submit-btn">
        {{ submitting || reviews.saving ? 'Posting...' : 'Post review' }}
      </button>
    </template>
  </form>
</template>
