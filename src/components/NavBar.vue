<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCourseCartStore } from '@/stores/courseCart'
import { ref } from 'vue'
import { Collapse } from 'bootstrap'

const auth = useAuthStore()
const cart = useCourseCartStore()
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

          <li class="nav-item">
            <RouterLink
              class="nav-link"
              to="/courses"
              data-testid="nav-courses"
              @click="closeMobileMenu"
            >
              Courses
              <span v-if="cart.items.length" class="badge rounded-pill text-bg-light ms-1" data-testid="nav-cart-count">{{ cart.items.length }}</span>
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
                to="/schedule"
                data-testid="nav-schedule"
                @click="closeMobileMenu"
              >
                Schedule
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
