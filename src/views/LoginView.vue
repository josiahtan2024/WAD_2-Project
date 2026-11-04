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
  <div class="container py-5 my-3">
    <section class="row justify-content-center" data-testid="login-page">
      <div class="col-12 col-md-6 col-lg-5 col-xl-4">
        
        <div class="card border shadow-sm rounded-4 p-4 p-sm-5 bg-white">
          <div class="text-center mb-4">
            <h1 class="page-title h3 fw-bold text-navy mb-1">Welcome Back</h1>
          </div>

          <form @submit.prevent="submit">
            <div class="mb-3">
              <label class="form-label fw-semibold small text-secondary" for="login-email">Email</label>
              <input id="login-email" v-model="email" type="email" class="form-control" required data-testid="login-email-input" />
            </div>

            <div class="mb-4">
              <label class="form-label fw-semibold small text-secondary" for="login-password">Password</label>
              <input id="login-password" v-model="password" type="password" class="form-control"  required data-testid="login-password-input" />
            </div>

            <div v-if="error" class="alert alert-danger py-2 small mb-3" data-testid="login-error">{{ error }}</div>

            <button class="btn btn-primary w-100 py-2 rounded-pill shadow-sm" :disabled="loading" data-testid="login-submit-btn">
              <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              {{ loading ? 'Logging In...' : 'Log In' }}
            </button>
          </form>

          <div class="text-center mt-4 pt-3 border-top">
            <p class="text-muted small mb-0">Don't have an account? <RouterLink to="/signup" class="fw-semibold text-decoration-none">Sign Up</RouterLink></p>
          </div>
        </div>

      </div>
    </section>    
  </div>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}
.card {
  border-color: rgba(215, 222, 234, 0.6) !important;
}
</style>