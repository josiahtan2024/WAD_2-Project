<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useReviewsStore } from '@/stores/reviews'
import Notice from '@/components/AppNotice.vue'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue'

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

// an admin can remove any comment, and says so, so nobody mistakes it for their own
const pendingRemoval = ref(null)
const removingComment = ref(false)
const removalIsMine = computed(() => pendingRemoval.value?.user_id === auth.user?.id)

function remove(comment) {
  pendingRemoval.value = comment
}

async function confirmRemoval() {
  if (!pendingRemoval.value || removingComment.value) return
  error.value = ''
  removingComment.value = true
  const deletingOwnComment = removalIsMine.value
  try {
    await reviews.removeComment(props.review.id, pendingRemoval.value.id)
    showSuccess(
      deletingOwnComment
        ? 'Your comment was deleted successfully.'
        : 'The comment was removed successfully.'
    )
  } catch (e) {
    error.value = e.message
  } finally {
    pendingRemoval.value = null
    removingComment.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Notice :success-message="successMessage" @dismiss-success="dismissSuccess" />
    <DeleteConfirmDialog
      :open="!!pendingRemoval"
      :title="removalIsMine ? 'Delete Comment?' : 'Remove Student Comment?'"
      action-label="Delete"
      working-label="Deleting..."
      :working="removingComment"
      @cancel="pendingRemoval = null"
      @confirm="confirmRemoval"
    >
      <template #description>
        <span v-if="removalIsMine">Are you sure you want to delete your comment?</span>
        <span v-else>This comment will be removed and the student will not be notified.</span>
        <br>This action cannot be undone.
      </template>
    </DeleteConfirmDialog>
  </Teleport>
  <div class="mt-3 pt-3 border-top" data-testid="review-comments">
    <h3 class="h6 fw-bold text-navy mb-2 fs-8 text-uppercase tracking-wider">
      Comments ({{ review.review_comments.length }})
    </h3>
    <ul class="list-unstyled small mb-3 d-flex flex-column gap-2">
      <li
        v-for="c in review.review_comments"
        :key="c.id"
        class="d-flex justify-content-between align-items-start gap-2 bg-white p-3 rounded-3 border"
        data-testid="comment-item"
      >
        <span class="text-break text-navy small" style="white-space: pre-line">{{ c.body }}</span>
        <button
          v-if="c.user_id === auth.user?.id || auth.adminActive"
          type="button"
          class="btn btn-sm btn-outline-danger rounded-circle lh-1 remove-btn flex-shrink-0"
          :data-testid="c.user_id === auth.user?.id ? 'comment-delete-btn' : 'comment-remove-btn'"
          :title="c.user_id === auth.user?.id ? 'Delete' : 'Remove'"
          :aria-label="c.user_id === auth.user?.id ? 'Delete' : 'Remove'"
          @click="remove(c)"
        >
          <i class="bi bi-trash"></i>
        </button>
      </li>
    </ul>
    <div v-if="error" class="text-danger small mb-2" data-testid="comment-error">{{ error }}</div>
    <form v-if="auth.user" class="d-flex gap-2" data-testid="comment-form" @submit.prevent="send">
      <input
        v-model="text"
        class="form-control form-control-sm shadow-none"
        maxlength="500"
        placeholder="Add a Comment"
        aria-label="Add a Comment"
        data-testid="comment-input"
      />
      <button
        class="btn btn-primary btn-sm rounded-pill px-3"
        :disabled="sending"
        data-testid="comment-submit-btn"
      >
        Post
      </button>
    </form>
    <p v-else class="small text-muted mb-0" data-testid="comment-login-prompt">
      <RouterLink to="/login" class="link-primary">Log In</RouterLink> to comment.
    </p>
  </div>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.fs-8 {
  font-size: 0.75rem;
}

.fs-9 {
  font-size: 0.6875rem;
}

.tracking-wider {
  letter-spacing: 0.05em;
}

.remove-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
}
</style>