<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.signup(email.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="row justify-content-center" data-testid="signup-page">
    <div class="col-12 col-md-6 col-lg-4">
      <h1 class="h3 mb-3">Sign up</h1>
      <form @submit.prevent="submit">
        <div class="mb-3">
          <label class="form-label" for="signup-email">Email</label>
          <input id="signup-email" v-model="email" type="email" class="form-control" required data-testid="signup-email-input" />
        </div>
        <div class="mb-3">
          <label class="form-label" for="signup-password">Password</label>
          <input id="signup-password" v-model="password" type="password" minlength="6" class="form-control" required data-testid="signup-password-input" />
        </div>
        <div v-if="error" class="alert alert-danger" data-testid="signup-error">{{ error }}</div>
        <button class="btn btn-primary w-100" :disabled="loading" data-testid="signup-submit-btn">
          {{ loading ? 'Creating account...' : 'Create account' }}
        </button>
      </form>
      <p class="mt-3 mb-0">Already have an account? <RouterLink to="/login">Log in</RouterLink></p>
    </div>
  </section>
</template>
