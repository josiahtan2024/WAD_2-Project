import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useShortlistStore } from '@/stores/shortlist'
import { useScheduleStore } from '@/stores/schedule'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
    error: null,
    initialized: false,
    previewAsStudent: false, // lets an admin see the site the way students do
  }),
  getters: {
    // role is set from the Supabase dashboard (app_metadata), users cannot change it themselves
    isAdmin: (state) => state.user?.app_metadata?.role === 'admin',
    // admin controls show only for an admin who is not previewing the student view
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
    },
    togglePreview() {
      this.previewAsStudent = !this.previewAsStudent
    },
    /** Restore the session on app start (supabase.auth.getSession) and listen for changes. */
    async init() {
      if(this.initialized) return

      this.loading = true
      this.error = null

      try{
        const { data, error } = await supabase.auth.getSession()
        if(error) throw error
        this.setUser(data.session?.user ?? null)
        supabase.auth.onAuthStateChange((_event, session) => {
          this.setUser(session?.user ?? null)
        })
        this.initialized = true} catch(error) {
          this.error = error.message
          throw error
      } finally {
        this.loading = false}
    },
    /** @param {string} email @param {string} password */
    async signup(email, password) {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), 
          password, })
        if (error) throw error
        if(data.session){
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
    /** @param {string} email @param {string} password */
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
