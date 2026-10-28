<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ref } from 'vue'
import { Collapse } from 'bootstrap'

const auth = useAuthStore()
const router = useRouter()
const mobileMenuOpen = ref(false)

function toggleMobileMenu() {
  const menu = document.getElementById('nav-menu')
  if (!menu || window.innerWidth >= 768) return

  const collapse = Collapse.getOrCreateInstance(menu, { toggle: false })
  if (menu.classList.contains('show')) {
    collapse.hide()
    mobileMenuOpen.value = false
  } else {
    collapse.show()
    mobileMenuOpen.value = true
  }
}

function closeMobileMenu() {
  if (window.innerWidth >= 768) return

  const menu = document.getElementById('nav-menu')
  if (menu) Collapse.getOrCreateInstance(menu, { toggle: false }).hide()
  mobileMenuOpen.value = false
}

async function logout() {
  closeMobileMenu()
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <nav class="navbar navbar-expand-md border-bottom app-navbar" 
  data-bs-theme="dark"
  data-testid="nav-bar">
    <div class="container-xl">
      <RouterLink
        class="navbar-brand fw-semibold"
        to="/"
        data-testid="nav-brand"
      >
        SMUXchange
      </RouterLink>

      <button
        class="navbar-toggler"
        type="button"
        aria-label="Toggle navigation"
        :aria-expanded="mobileMenuOpen"
        @click="toggleMobileMenu"
        data-testid="nav-toggle"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div id="nav-menu" class="collapse navbar-collapse">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <RouterLink
              class="nav-link"
              to="/universities"
              data-testid="nav-universities"
              @click="closeMobileMenu"
            >
              Universities
            </RouterLink>
          </li>

          <li class="nav-item">
            <RouterLink
              class="nav-link"
              to="/compare"
              data-testid="nav-compare"
              @click="closeMobileMenu"
            >
              Compare
            </RouterLink>
          </li>

          <template v-if="auth.user">
            <li class="nav-item">
              <RouterLink
                class="nav-link"
                to="/shortlist"
                data-testid="nav-shortlist"
                @click="closeMobileMenu"
              >
                Shortlist
              </RouterLink>
            </li>

            <li class="nav-item">
              <RouterLink
                class="nav-link"
                to="/cost-estimator"
                data-testid="nav-cost-estimator"
                @click="closeMobileMenu"
              >
                Budget
              </RouterLink>
            </li>
          </template>
        </ul>

        <div class="d-flex gap-2">
          <template v-if="auth.user">
            <template v-if="auth.isAdmin">
              <span v-if="auth.adminActive" class="badge text-bg-warning align-self-center" data-testid="nav-staff-badge">Staff</span>
              <span v-else class="badge text-bg-info align-self-center" data-testid="nav-preview-badge">Student view</span>
              <button
                class="btn btn-outline-light btn-sm"
                data-testid="nav-preview-toggle"
                @click="auth.togglePreview()"
              >
                {{ auth.previewAsStudent ? 'Back to staff view' : 'View as student' }}
              </button>
            </template>

            <button
              class="btn btn-outline-light btn-sm"
              @click="logout"
              data-testid="nav-logout-btn"
            >
              Log out
            </button>

          </template>

          <template v-else>

            <RouterLink
              class="btn btn-outline-light btn-sm"
              to="/login"
              data-testid="nav-login-link"
              @click="closeMobileMenu"
            >
              Log in
            </RouterLink>

            <RouterLink
              class="btn btn-light btn-sm nav-signup"
              to="/signup"
              data-testid="nav-signup-link"
              @click="closeMobileMenu"
            >
              Sign up
            </RouterLink>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
