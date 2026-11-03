import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: 'Home' } },
  { path: '/about', name: 'about', component: () => import('@/views/AboutView.vue'), meta: { title: 'About Us' } },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: 'Login' } },
  { path: '/signup', name: 'signup', component: () => import('@/views/SignupView.vue'), meta: { title: 'Sign Up' } },
  { path: '/universities', name: 'universities', component: () => import('@/views/UniversitiesView.vue'), meta: { title: 'Partner Universities' } },
  { path: '/universities/:id', name: 'university', component: () => import('@/views/UniversityView.vue'), meta: { title: 'University Details' } },
  { path: '/shortlist', name: 'shortlist', component: () => import('@/views/ShortlistView.vue'), meta: { title: 'My Shortlist', requiresAuth: true } },
  { path: '/compare', name: 'compare', component: () => import('@/views/CompareView.vue'), meta: { title: 'Compare Universities' } },
  { path: '/courses', name: 'courses', component: () => import('@/views/CourseSearchView.vue'), meta: { title: 'Course Search' } },
  { path: '/cost-estimator', name: 'cost-estimator', component: () => import('@/views/CostEstimatorView.vue'), meta: { title: 'Cost Estimator', requiresAuth: true }, },
  { path: '/schedule/:universityId?', name: 'schedule', component: () => import('@/views/ScheduleView.vue'), meta: { title: 'My Schedule', requiresAuth: true } },
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
