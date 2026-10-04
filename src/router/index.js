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

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/signup', name: 'signup', component: SignupView },
  { path: '/universities', name: 'universities', component: UniversitiesView },
  { path: '/universities/:id', name: 'university', component: UniversityView },
  { path: '/shortlist', name: 'shortlist', component: ShortlistView, meta: { requiresAuth: true } },
  { path: '/compare', name: 'compare', component: CompareView, meta: { requiresAuth: true } },
  {
    path: '/schedule/:universityId',
    name: 'schedule',
    component: ScheduleView,
    meta: { requiresAuth: true },
  },
]

const router = createRouter({ history: createWebHistory(), routes })

// Login guard: logged-out users are sent to /login and returned afterwards.
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  const auth = useAuthStore()
  // TODO(student): auth.init() should restore the session before this check (see stores/auth.js)
  if (!auth.user) return { name: 'login', query: { redirect: to.fullPath } }
  return true
})

export default router
