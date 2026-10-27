<script setup>
import { computed, reactive, ref, useId } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { REVIEW_TOPICS, reviewImageUrl, useReviewsStore } from '@/stores/reviews'
import StarRating from '@/components/StarRating.vue'

const props = defineProps({
  loggedIn: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  review: { type: Object, default: null }, // pass one of your own reviews to edit it
})
// UniversityView still listens for `submit`. It is declared so Vue doesn't attach that
// handler to the <form> itself; posting happens here, through the store.
const emit = defineEmits(['submit', 'saved', 'cancel'])

const route = useRoute()
const auth = useAuthStore()
const reviews = useReviewsStore()
const uid = useId()

const editing = computed(() => !!props.review)
const alreadyReviewed = computed(() => !editing.value && !!reviews.reviewOf(auth.user?.id))
// don't offer the form until we know whether this user has already reviewed the university
const canShow = computed(() => editing.value || reviews.isLoadedFor(route.params.id) || !!reviews.error)

const rating = ref(Math.round(Number(props.review?.rating ?? 0)))
const topics = reactive(Object.fromEntries(REVIEW_TOPICS.map((t) => [t.key, props.review?.[t.key] ?? 0])))
const body = ref(props.review?.review ?? '')
const image = ref(null)
const imageInput = ref(null)
const removeImage = ref(false)
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
  const draft = { rating: rating.value, body: text, topics, image: image.value, removeImage: removeImage.value }
  try {
    if (editing.value) {
      await reviews.update(props.review.id, draft)
      emit('saved')
    } else {
      await reviews.post(route.params.id, draft)
      reset()
    }
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <p v-if="!loggedIn" class="mt-3 text-muted" data-testid="review-login-prompt">
    <RouterLink to="/login">Log in</RouterLink> to post a review.
  </p>
  <p v-else-if="alreadyReviewed" class="mt-3 text-muted" data-testid="review-already-posted">
    You have already reviewed this university. You can edit or delete your review above.
  </p>
  <form v-else-if="canShow" class="mt-3" data-testid="review-form" @submit.prevent="submit">
    <h3 class="h6">{{ editing ? 'Edit your review' : 'Write a review' }}</h3>
    <StarRating v-model="rating" label="Overall rating" testid="review-rating" />
    <div class="row row-cols-1 row-cols-md-2 g-1 my-1">
      <div v-for="t in REVIEW_TOPICS" :key="t.key" class="col">
        <StarRating v-model="topics[t.key]" :label="t.label" :testid="`review-${t.key}`" />
      </div>
    </div>
    <label class="form-label mt-2" :for="`${uid}-body`">Your review</label>
    <textarea :id="`${uid}-body`" v-model="body" class="form-control mb-2" rows="3" maxlength="2000" required data-testid="review-body-input"></textarea>

    <div v-if="editing && review.image_path" class="mb-2">
      <img :src="reviewImageUrl(review.image_path)" alt="Current photo" class="img-thumbnail d-block mb-1" style="max-height: 6rem" />
      <div class="form-check">
        <input :id="`${uid}-remove`" v-model="removeImage" type="checkbox" class="form-check-input" data-testid="review-remove-image" />
        <label class="form-check-label" :for="`${uid}-remove`">Remove this photo</label>
      </div>
    </div>
    <label class="form-label" :for="`${uid}-image`">
      {{ editing && review.image_path ? 'Replace photo' : 'Photo' }} (optional, JPG, PNG or WebP up to 2 MB)
    </label>
    <input :id="`${uid}-image`" ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp" class="form-control mb-2" data-testid="review-image-input" @change="pickImage" />

    <div v-if="error" class="alert alert-danger py-2" data-testid="review-form-error">{{ error }}</div>
    <div class="d-flex gap-2">
      <button class="btn btn-primary" :disabled="submitting || reviews.saving" data-testid="review-submit-btn">
        {{ submitting || reviews.saving ? 'Saving...' : editing ? 'Save changes' : 'Post review' }}
      </button>
      <button v-if="editing" type="button" class="btn btn-outline-secondary" data-testid="review-cancel-btn" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
