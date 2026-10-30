<script setup>
import { onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useReviewsStore } from '@/stores/reviews'
import BudgetNotice from '@/components/BudgetNotice.vue'

const props = defineProps({ review: { type: Object, required: true } })

const auth = useAuthStore()
const reviews = useReviewsStore()
const text = ref('')
const sending = ref(false)
const error = ref('')
const successMessage = ref('')
let successTimeout = null

function showSuccess(message) {
  if (successTimeout) clearTimeout(successTimeout)
  successMessage.value = message
  successTimeout = setTimeout(() => {
    successMessage.value = ''
    successTimeout = null
  }, 5000)
}

function dismissSuccess() {
  successMessage.value = ''
  if (successTimeout) clearTimeout(successTimeout)
  successTimeout = null
}

onUnmounted(() => {
  if (successTimeout) clearTimeout(successTimeout)
})

async function send() {
  const body = text.value.trim()
  if (!body || sending.value) return
  sending.value = true
  error.value = ''
  try {
    await reviews.addComment(props.review.id, body)
    text.value = ''
    showSuccess('Your comment was posted successfully.')
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
  }
}

async function remove(comment) {
  error.value = ''
  const deletingOwnComment = comment.user_id === auth.user?.id
  try {
    await reviews.removeComment(props.review.id, comment.id)
    showSuccess(deletingOwnComment
      ? 'Your comment was deleted successfully.'
      : 'The comment was removed successfully.')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <Teleport to="body">
    <BudgetNotice :success-message="successMessage" @dismiss-success="dismissSuccess" />
  </Teleport>
  <div class="mt-3 pt-2 border-top" data-testid="review-comments">
    <h3 class="h6 text-muted">Comments ({{ review.review_comments.length }})</h3>
    <ul class="list-unstyled small mb-2">
      <li v-for="c in review.review_comments" :key="c.id" class="d-flex justify-content-between gap-2 mb-1" data-testid="comment-item">
        <span class="text-break" style="white-space: pre-line">{{ c.body }}</span>
        <button v-if="c.user_id === auth.user?.id" type="button" class="btn btn-outline-danger btn-sm" data-testid="comment-delete-btn" @click="remove(c)">Delete</button>
        <button v-else-if="auth.adminActive" type="button" class="btn btn-outline-danger btn-sm" data-testid="comment-remove-btn" @click="remove(c)">Remove</button>
      </li>
    </ul>
    <div v-if="error" class="text-danger small mb-1" data-testid="comment-error">{{ error }}</div>
    <form v-if="auth.user" class="d-flex gap-2" data-testid="comment-form" @submit.prevent="send">
      <input v-model="text" class="form-control form-control-sm" maxlength="500" placeholder="Add a Comment" aria-label="Add a Comment" data-testid="comment-input" />
      <button class="btn btn-outline-primary btn-sm" :disabled="sending" data-testid="comment-submit-btn">Post</button>
    </form>
    <p v-else class="small text-muted mb-0" data-testid="comment-login-prompt">
      <RouterLink to="/login">Log In</RouterLink> to comment.
    </p>
  </div>
</template>
