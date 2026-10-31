import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import SignupView from '@/views/SignupView.vue'
import UniversitiesView from '@/views/UniversitiesView.vue'
import UniversityView from '@/views/UniversityView.vue'
import ShortlistView from '@/views/ShortlistView.vue'
import CompareView from '@/views/CompareView.vue'
import ScheduleView from '@/views/ScheduleView.vue'
import CostEstimator from '@/views/CostEstimatorView.vue'
import CourseSearchView from '@/views/CourseSearchView.vue'
import AboutView from '@/views/AboutView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView, meta: { title: 'Home' } },
  { path: '/about', name: 'about', component: AboutView, meta: { title: 'About Us' } },
  { path: '/login', name: 'login', component: LoginView, meta: { title: 'Login' } },
  { path: '/signup', name: 'signup', component: SignupView, meta: { title: 'Sign Up' } },
  { path: '/universities', name: 'universities', component: UniversitiesView, meta: { title: 'Partner Universities' } },
  { path: '/universities/:id', name: 'university', component: UniversityView, meta: { title: 'University Details' } },
  { path: '/shortlist', name: 'shortlist', component: ShortlistView, meta: { title: 'My Shortlist', requiresAuth: true } },
  { path: '/compare', name: 'compare', component: CompareView, meta: { title: 'Compare Universities' } },
  { path: '/courses', name: 'courses', component: CourseSearchView, meta: { title: 'Course Search' } },
  { path: '/cost-estimator', name: 'cost-estimator', component: CostEstimator, meta: { title: 'Cost Estimator', requiresAuth: true }, },
  { path: '/schedule/:universityId?', name: 'schedule', component: ScheduleView, meta: { title: 'My Schedule', requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    // Restore the prior position for browser back/forward; start new views at the top.
    return savedPosition ?? { top: 0, left: 0 }
  },
})

// Login guard: logged-out users are sent to /login and returned afterwards.
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  const auth = useAuthStore()
  await auth.init()
  if (!auth.user) return { name: 'login', query: { redirect: to.fullPath } }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | SMUXchange` : 'SMUXchange'
})

export default router