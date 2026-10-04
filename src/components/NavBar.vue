<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <nav class="navbar navbar-expand-md bg-white border-bottom" data-testid="nav-bar">
    <div class="container-xl">
      <RouterLink class="navbar-brand fw-semibold" to="/" data-testid="nav-brand">Exchange Planner</RouterLink>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav-menu" aria-label="Toggle navigation" data-testid="nav-toggle">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div id="nav-menu" class="collapse navbar-collapse">
        <ul class="navbar-nav me-auto">
          <li class="nav-item"><RouterLink class="nav-link" to="/universities" data-testid="nav-universities">Universities</RouterLink></li>
          <template v-if="auth.user">
            <li class="nav-item"><RouterLink class="nav-link" to="/shortlist" data-testid="nav-shortlist">Shortlist</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link" to="/compare" data-testid="nav-compare">Compare</RouterLink></li>
          </template>
        </ul>
        <div class="d-flex gap-2">
          <template v-if="auth.user">
            <button class="btn btn-outline-secondary btn-sm" @click="logout" data-testid="nav-logout-btn">Log out</button>
          </template>
          <template v-else>
            <RouterLink class="btn btn-outline-primary btn-sm" to="/login" data-testid="nav-login-link">Log in</RouterLink>
            <RouterLink class="btn btn-primary btn-sm" to="/signup" data-testid="nav-signup-link">Sign up</RouterLink>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
