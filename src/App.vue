<script setup>
import NavBar from '@/components/NavBar.vue'
import AppFooter from '@/components/AppFooter.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="app-shell">
    <NavBar />
    <div v-if="auth.isAdmin" class="admin-mode-indicator" data-testid="admin-mode-indicator">
      <span :data-testid="auth.adminActive ? 'nav-staff-badge' : 'nav-preview-badge'">
        {{ auth.adminActive ? 'Staff' : 'Student view' }}
      </span>
    </div>
    <main class="container-xl py-4 flex-grow-1" :class="{ 'with-admin-indicator': auth.isAdmin }">
      <RouterView />
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.admin-mode-indicator {
  position: fixed;
  top: calc(var(--app-navbar-height) + 0.75rem);
  right: 1rem;
  z-index: 1060;
  padding: 0.4rem 0.75rem;
  border: 1px solid #d7a900;
  border-radius: 999px;
  background: #fff;
  color: #775900;
  box-shadow: 0 0.25rem 0.75rem rgba(11, 35, 72, 0.14);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.2;
}

.with-admin-indicator { padding-top: 3.75rem !important; }

@media (max-width: 575.98px) {
  .admin-mode-indicator {
    top: calc(var(--app-navbar-height) + 0.5rem);
    right: 0.75rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
  }

  .with-admin-indicator { padding-top: 3.5rem !important; }
}
</style>
