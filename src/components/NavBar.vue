<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCourseCartStore } from '@/stores/courseCart'
import { Collapse } from 'bootstrap'

const auth = useAuthStore()
const cart = useCourseCartStore()
const router = useRouter()

const mobileMenuOpen = ref(false)

let menuElement = null
let collapseInstance = null

function handleMenuShown() {
  mobileMenuOpen.value = true
}

function handleMenuHidden() {
  mobileMenuOpen.value = false
}

function toggleMobileMenu() {
  collapseInstance?.toggle()
}

function closeMobileMenu() {
  if (!collapseInstance || window.innerWidth >= 992) return

  collapseInstance.hide()
}

function togglePreview() {
  auth.togglePreview()
  closeMobileMenu()
}

async function logout() {
  try {
    closeMobileMenu()
    await auth.logout()
    await router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

onMounted(() => {
  menuElement = document.getElementById('nav-menu')

  if (!menuElement) return

  collapseInstance = Collapse.getOrCreateInstance(menuElement, {
    toggle: false,
  })

  menuElement.addEventListener('shown.bs.collapse', handleMenuShown)
  menuElement.addEventListener('hidden.bs.collapse', handleMenuHidden)
})

onBeforeUnmount(() => {
  if (!menuElement) return

  menuElement.removeEventListener('shown.bs.collapse', handleMenuShown)
  menuElement.removeEventListener('hidden.bs.collapse', handleMenuHidden)

  collapseInstance?.dispose()
  collapseInstance = null
})
</script>

<template>
  <nav
    class="navbar navbar-expand-lg border-bottom app-navbar"
    data-bs-theme="dark"
    data-testid="nav-bar">
    <div class="container-xl">
      <RouterLink
        class="navbar-brand fw-semibold"
        to="/"
        data-testid="nav-brand">
        SMUXchange
      </RouterLink>

      <button
        class="navbar-toggler"
        type="button"
        aria-controls="nav-menu"
        :aria-expanded="mobileMenuOpen"
        aria-label="Toggle navigation"
        @click="toggleMobileMenu"
        data-testid="nav-toggle">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div id="nav-menu" class="collapse navbar-collapse">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <RouterLink
              class="nav-link"
              to="/universities"
              data-testid="nav-universities"
              @click="closeMobileMenu">
              Partner Universities
            </RouterLink>
          </li>

          <li class="nav-item">
            <RouterLink
              class="nav-link"
              to="/compare"
              data-testid="nav-compare"
              @click="closeMobileMenu">
              Compare
            </RouterLink>
          </li>

          <li class="nav-item">
            <RouterLink
              class="nav-link"
              to="/courses"
              data-testid="nav-courses"
              @click="closeMobileMenu">
              Courses
              <span v-if="cart.items.length"
                class="badge rounded-pill text-bg-light ms-1"
                data-testid="nav-cart-count"
                :aria-label="`${cart.items.length} courses in cart`">
                {{ cart.items.length }}
              </span>
            </RouterLink>
          </li>

          <template v-if="auth.user">
            <li class="nav-item">
              <RouterLink
                class="nav-link"
                to="/shortlist"
                data-testid="nav-shortlist"
                @click="closeMobileMenu">
                Shortlist
              </RouterLink>
            </li>

            <li class="nav-item">
              <RouterLink
                class="nav-link"
                to="/schedule"
                data-testid="nav-schedule"
                @click="closeMobileMenu">
                Schedule
              </RouterLink>
            </li>

            <li class="nav-item">
              <RouterLink
                class="nav-link"
                to="/cost-estimator"
                data-testid="nav-cost-estimator"
                @click="closeMobileMenu">
                Budget
              </RouterLink>
            </li>
          </template>
        </ul>

        <div class="d-flex gap-2">
          <template v-if="auth.user">
            <button v-if="auth.isAdmin"
              class="btn btn-outline-light btn-sm"
              data-testid="nav-preview-toggle"
              @click="togglePreview">
              {{ auth.previewAsStudent ? 'Back to Staff View' : 'View as Student' }}
            </button>

            <button
              class="btn btn-outline-light btn-sm"
              data-testid="nav-logout-btn"
              @click="logout">
              Log Out
            </button>
          </template>

          <template v-else>
            <RouterLink
              class="btn btn-outline-light btn-sm"
              to="/login"
              data-testid="nav-login-link"
              @click="closeMobileMenu">
              Log In
            </RouterLink>

            <RouterLink
              class="btn btn-light btn-sm nav-signup"
              to="/signup"
              data-testid="nav-signup-link"
              @click="closeMobileMenu">
              Sign Up
            </RouterLink>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
