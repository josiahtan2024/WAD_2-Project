<script setup>
import { ref } from 'vue'

defineProps({ loggedIn: { type: Boolean, default: false }, submitting: { type: Boolean, default: false } })
const emit = defineEmits(['submit'])
const body = ref('')

function submit() {
  const text = body.value.trim()
  if (!text) return
  emit('submit', text, () => (body.value = ''))
}
</script>

<template>
  <form class="mt-3" data-testid="review-form" @submit.prevent="submit">
    <p v-if="!loggedIn" class="text-muted" data-testid="review-login-prompt">
      <RouterLink to="/login">Log in</RouterLink> to post a review.
    </p>
    <template v-else>
      <label class="form-label" for="review-body">Your review</label>
      <textarea id="review-body" v-model="body" class="form-control mb-2" rows="3" required data-testid="review-body-input"></textarea>
      <button class="btn btn-primary" :disabled="submitting" data-testid="review-submit-btn">
        {{ submitting ? 'Posting...' : 'Post review' }}
      </button>
    </template>
  </form>
</template>
