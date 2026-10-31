import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useShortlistStore } from '@/stores/shortlist'
import { useScheduleStore } from '@/stores/schedule'
import { useCourseCartStore } from '@/stores/courseCart'

let initPromise = null
let authSubscription = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
    error: null,
    initialized: false,
    previewAsStudent: false,
  }),

  getters: {
    // Role comes from Supabase app_metadata
    isAdmin: (state) => state.user?.app_metadata?.role === 'admin',

    adminActive() {
      return this.isAdmin && !this.previewAsStudent
    },
  },

  actions: {
    setUser(user) {
      const oldId = this.user?.id ?? null
      const newId = user?.id ?? null

      if (oldId !== newId) {
        useShortlistStore().$reset()
        useScheduleStore().$reset()
        this.previewAsStudent = false
      }

      this.user = user

      // Reload the cart when the authenticated user changes
      if (oldId !== newId || !this.initialized) {
        useCourseCartStore().load()
      }
    },

    togglePreview() {
      if (!this.isAdmin) return
      this.previewAsStudent = !this.previewAsStudent
    },

    // Restore the Supabase session and register a single authentication state listener
    async init() {
      if (this.initialized) return

      if (initPromise) return initPromise

      initPromise = (async () => {
        this.loading = true
        this.error = null

        try {
          if (!authSubscription) {
            const { data } = supabase.auth.onAuthStateChange(
              (_event, session) => {
                this.setUser(session?.user ?? null)
              }
            )

            authSubscription = data.subscription
          }

          const { data, error } = await supabase.auth.getSession()

          if (error) throw error

          this.setUser(data.session?.user ?? null)
          this.initialized = true

        } catch (error) {
          this.error = error.message

          authSubscription?.unsubscribe()
          authSubscription = null

          throw error
        } finally {
          this.loading = false
          initPromise = null
        }
      })()

      return initPromise
    },

    async signup(email, password) {
      this.loading = true
      this.error = null

      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })

        if (error) throw error

        if (data.session) {
          this.setUser(data.session.user)
        }

        return data
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async login(email, password) {
      this.loading = true
      this.error = null

      try {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })

        if (error) throw error

        this.setUser(data.user)

        return data.user
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      this.loading = true
      this.error = null

      try {
        const { error } = await supabase.auth.signOut({
          scope: 'local',
        })

        if (error) throw error

        this.setUser(null)
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})
