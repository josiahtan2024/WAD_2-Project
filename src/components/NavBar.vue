<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCourseCartStore } from '@/stores/courseCart'
import { Offcanvas } from 'bootstrap'

const auth = useAuthStore()
const cart = useCourseCartStore()
const router = useRouter()

const mobileMenuOpen = ref(false)

let menuElement = null
let offcanvasInstance = null

function handleMenuShown() {
  mobileMenuOpen.value = true
}

function handleMenuHidden() {
  mobileMenuOpen.value = false
}

function toggleMobileMenu() {
  offcanvasInstance?.toggle()
}

function closeMobileMenu() {
  if (!offcanvasInstance) return

  offcanvasInstance.hide()
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

  offcanvasInstance = Offcanvas.getOrCreateInstance(menuElement, {
    toggle: false,
  })

  menuElement.addEventListener('shown.bs.offcanvas', handleMenuShown)
  menuElement.addEventListener('hidden.bs.offcanvas', handleMenuHidden)
})

onBeforeUnmount(() => {
  if (!menuElement) return

  menuElement.removeEventListener('shown.bs.offcanvas', handleMenuShown)
  menuElement.removeEventListener('hidden.bs.offcanvas', handleMenuHidden)

  offcanvasInstance?.dispose()
  offcanvasInstance = null
})
</script>

<template>
  <nav class="navbar navbar-expand-xxl border-bottom app-navbar" data-bs-theme="dark" data-testid="nav-bar">
    <div class="container-fluid">
      
      <RouterLink class="navbar-brand fw-semibold me-4 me-xxl-5" to="/" data-testid="nav-brand">
        <i class="bi bi-globe-americas me-1" aria-hidden="true"></i>
        SMUXchange
      </RouterLink>

      <!-- Desktop XXL -->
      <div class="d-none d-xxl-flex align-items-center flex-grow-1 justify-content-between">

        <ul class="navbar-nav flex-row me-auto mb-0 gap-1">
          <li class="nav-item w-auto">
            <RouterLink class="nav-link fs-6 fw-semibold" to="/universities" data-testid="nav-universities">Partner Universities</RouterLink>
          </li>
          <li class="nav-item w-auto">
            <RouterLink class="nav-link fs-6 fw-semibold" to="/compare" data-testid="nav-compare">Compare</RouterLink>
          </li>
          <template v-if="auth.user">
            <li class="nav-item w-auto">
              <RouterLink class="nav-link fs-6 fw-semibold" to="/shortlist" data-testid="nav-shortlist">Shortlist</RouterLink>
            </li>
          </template>
          <li class="nav-item w-auto">
            <RouterLink class="nav-link fs-6 fw-semibold" to="/courses" data-testid="nav-courses">
              Courses
              <span v-if="cart.items.length" class="course-count ms-1" data-testid="nav-cart-count">{{ cart.items.length }}</span>
            </RouterLink>
          </li>
          <template v-if="auth.user">
            <li class="nav-item w-auto">
              <RouterLink class="nav-link fs-6 fw-semibold" to="/cost-estimator" data-testid="nav-cost-estimator">Budget</RouterLink>
            </li>
            <li class="nav-item w-auto">
              <RouterLink class="nav-link fs-6 fw-semibold" to="/schedule" data-testid="nav-schedule">Schedule</RouterLink>
            </li>
          </template>
          <li class="nav-item w-auto">
            <RouterLink class="nav-link fs-6 fw-semibold" to="/about" data-testid="nav-about">About Us</RouterLink>
          </li>
        </ul>

        <!-- Desktop Auth -->
        <div class="d-flex align-items-center gap-2">
          <template v-if="auth.user">
            <span v-if="auth.isAdmin" class="admin-mode-indicator" :class="auth.adminActive ? 'is-admin' : 'is-preview'" :data-testid="auth.adminActive ? 'nav-staff-badge' : 'nav-preview-badge'">
              <span class="status-dot"></span>
              {{ auth.adminActive ? 'Admin' : 'Student Preview' }}
            </span>
            <button v-if="auth.isAdmin" class="btn btn-outline-light btn-sm" data-testid="nav-preview-toggle" @click="auth.togglePreview()">
              {{ auth.previewAsStudent ? 'Exit Preview' : 'Preview as Student' }}
            </button>
            <button class="btn btn-light btn-sm" data-testid="nav-logout-btn" @click="logout">Log Out</button>
          </template>
          <template v-else>
            <RouterLink class="btn btn-outline-light btn-sm" to="/login" data-testid="nav-login-link">Log In</RouterLink>
            <RouterLink class="btn btn-light btn-sm nav-signup" to="/signup" data-testid="nav-signup-link">Sign Up</RouterLink>
          </template>
        </div>
      </div>

      <!-- Offcanvas for below XXL -->
      <div class="d-flex d-xxl-none align-items-center gap-2 ms-auto">
        <template v-if="auth.user && auth.isAdmin">
        <span class="admin-mode-indicator d-none d-custom-min-inline-flex" 
          :class="auth.adminActive ? 'is-admin' : 'is-preview'" 
          :data-testid="auth.adminActive ? 'nav-staff-badge' : 'nav-preview-badge'">
          <span class="status-dot"></span>
          <template v-if="auth.adminActive">Admin</template>
          <template v-else>
            <span class="d-none d-sm-inline">Student Preview</span>
            <span class="d-inline d-sm-none">Student</span>
          </template>
        </span>
        </template>

        <button
          class="navbar-toggler d-flex align-items-center gap-2"
          type="button"
          aria-controls="nav-menu"
          :aria-expanded="mobileMenuOpen"
          aria-label="Toggle navigation"
          @click="toggleMobileMenu"
          data-testid="nav-toggle"
        >
          <span class="navbar-toggler-text fw-medium d-none d-sm-inline text-white">Menu</span>
          <span class="navbar-toggler-icon"></span>
        </button>
      </div>

      <div
        id="nav-menu"
        class="offcanvas offcanvas-end app-offcanvas d-xxl-none"
        tabindex="-1"
        aria-labelledby="nav-menu-label"
      >
        <div class="offcanvas-header custom-offcanvas-header">
          <button type="button" class="btn-close ms-auto" data-bs-dismiss="offcanvas" aria-label="Close" @click="closeMobileMenu"></button>
        </div>

        <div class="offcanvas-body d-flex flex-column w-100">
          <ul class="navbar-nav me-auto w-100">
            <li class="nav-item">
              <RouterLink class="nav-link fs-6 fw-semibold w-100 d-block border-bottom" to="/" data-testid="nav-home" @click="closeMobileMenu">Home</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link fs-6 fw-semibold w-100 d-block border-bottom" to="/universities" data-testid="nav-universities" @click="closeMobileMenu">Partner Universities</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link fs-6 fw-semibold w-100 d-block border-bottom" to="/compare" data-testid="nav-compare" @click="closeMobileMenu">Compare</RouterLink>
            </li>
            <template v-if="auth.user">
              <li class="nav-item">
                <RouterLink class="nav-link fs-6 fw-semibold w-100 d-block border-bottom" to="/shortlist" data-testid="nav-shortlist" @click="closeMobileMenu">Shortlist</RouterLink>
              </li>
            </template>
            <li class="nav-item">
              <RouterLink class="nav-link fs-6 fw-semibold w-100 d-block border-bottom" to="/courses" data-testid="nav-courses" @click="closeMobileMenu">
                Courses
                <span v-if="cart.items.length" class="course-count ms-2" data-testid="nav-cart-count">{{ cart.items.length }}</span>
              </RouterLink>
            </li>
            <template v-if="auth.user">
              <li class="nav-item">
                <RouterLink class="nav-link fs-6 fw-semibold w-100 d-block border-bottom" to="/cost-estimator" data-testid="nav-cost-estimator" @click="closeMobileMenu">Budget</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link fs-6 fw-semibold w-100 d-block border-bottom" to="/schedule" data-testid="nav-schedule" @click="closeMobileMenu">Schedule</RouterLink>
              </li>
            </template>
            <li class="nav-Item">
              <RouterLink class="nav-link fs-6 fw-semibold w-100 d-block border-bottom" to="/about" data-testid="nav-about" @click="closeMobileMenu">About Us</RouterLink>
            </li>
          </ul>

          <div class="d-flex gap-2 align-items-center flex-wrap pt-3 mt-auto">
            <template v-if="auth.user">
              <span v-if="auth.isAdmin" class="admin-mode-indicator mobile-admin-indicator d-inline-flex w-100 mb-2" :class="auth.adminActive ? 'is-admin' : 'is-preview-offcanvas'" :data-testid="auth.adminActive ? 'nav-staff-badge' : 'nav-preview-badge'">
                <span class="status-dot"></span>
                {{ auth.adminActive ? 'Admin Mode' : 'Student Preview' }}
              </span>
              <button v-if="auth.isAdmin" class="btn btn-outline-light btn-sm flex-fill" data-testid="nav-preview-toggle" @click="togglePreview">
                {{ auth.previewAsStudent ? 'Exit Preview' : 'Preview as Student' }}
              </button>
              <button class="btn btn-light btn-sm flex-fill" data-testid="nav-logout-btn" @click="logout">Log Out</button>
            </template>
            <template v-else>
              <RouterLink class="btn btn-outline-light btn-sm flex-fill" to="/login" data-testid="nav-login-link" @click="closeMobileMenu">Log In</RouterLink>
              <RouterLink class="btn btn-light btn-sm flex-fill nav-signup" to="/signup" data-testid="nav-signup-link" @click="closeMobileMenu">Sign Up</RouterLink>
            </template>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.admin-mode-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;

  white-space: nowrap;
  padding: 0.35rem 0.65rem;

  border: 1px solid transparent;
  border-radius: 6px;

  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  line-height: 1.2;

  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.admin-mode-indicator.is-admin {
  background-color: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.4);
  color: #86efac;
}

.admin-mode-indicator.is-preview {
  background-color: var(--app-blue);
  border-color: var(--app-gray-blue);
  color: #fff;
}

.admin-mode-indicator.is-preview-offcanvas {
  background-color: var(--app-navy);
  border-color: var(--app-gray-blue);
  color: #fff;
}

.status-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
}

.is-admin .status-dot {
  background-color: #4ade80;
}

.is-preview .status-dot,
.is-preview-offcanvas .status-dot {
  background-color: #fff;
}

.mobile-admin-indicator {
  justify-content: flex-start;
  padding: 0.7rem 0.85rem;
  line-height: 1;
  font-size: 0.75rem;
}

.app-offcanvas {
  background-color: var(--app-navy);
}

.custom-offcanvas-header {
  height: var(--app-navbar-height);
  padding-top: 0;
  padding-bottom: 0;
}

.offcanvas-end {
  border-left: 1px solid var(--app-navy);
}

.offcanvas-body {
  padding-top: 0rem;
}

@media (max-width: 1399.98px) {
  .offcanvas-body .navbar-nav,
  .offcanvas-body .navbar-nav .nav-item {
    width: 100%;
  }

  .offcanvas-body .navbar-nav .nav-link {
    display: block;
    width: 100%;
    padding: 1rem !important;
    box-sizing: border-box;
    border-color: rgba(255, 255, 255, 0.1) !important;
    transition: color 0.2s ease;
  }

  .offcanvas-body .navbar-nav .nav-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

@media (min-width: 1400px) {
  .navbar-nav .nav-link {
    white-space: nowrap !important;
    padding: 0.5rem 0.75rem !important;
    position: relative;
    border-radius: 6px;
    background-color: transparent !important;
    transition: color 0.2s ease;
  }

  .navbar-nav .nav-link:hover,
  .navbar-nav .nav-link.router-link-active {
    background-color: transparent !important;
    color: #ffffff !important;
  }

  .navbar-nav .nav-link.router-link-active::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0.85rem;
    right: 0.85rem;
    height: 2px;
    border-radius: 2px;
    background-color: #ffffff;
  }
}

.course-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  min-width: 21px;
  height: 21px;
  padding: 0 0.35rem;

  border-radius: 6px;
  background-color: var(--app-blue);
  border: 1px solid var(--app-gray-blue);

  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;

  vertical-align: middle;
  transition: background-color 0.2s ease;
}

.navbar-toggler:focus {
  box-shadow: none;
}

@media (max-width: 767.98px) {
  .app-offcanvas {
    width: 100% !important;
  }
}

@media (min-width: 375px) {
  .d-custom-min-inline-flex {
    display: inline-flex !important;
  }
}
</style>