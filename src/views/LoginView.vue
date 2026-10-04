<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push(route.query.redirect || '/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="row justify-content-center" data-testid="login-page">
    <div class="col-12 col-md-6 col-lg-4">
      <h1 class="h3 mb-3">Log in</h1>
      <form @submit.prevent="submit">
        <div class="mb-3">
          <label class="form-label" for="login-email">Email</label>
          <input id="login-email" v-model="email" type="email" class="form-control" required data-testid="login-email-input" />
        </div>
        <div class="mb-3">
          <label class="form-label" for="login-password">Password</label>
          <input id="login-password" v-model="password" type="password" class="form-control" required data-testid="login-password-input" />
        </div>
        <div v-if="error" class="alert alert-danger" data-testid="login-error">{{ error }}</div>
        <button class="btn btn-primary w-100" :disabled="loading" data-testid="login-submit-btn">
          {{ loading ? 'Logging in...' : 'Log in' }}
        </button>
      </form>
      <p class="mt-3 mb-0">No account? <RouterLink to="/signup">Sign up</RouterLink></p>
    </div>
  </section>
</template>
