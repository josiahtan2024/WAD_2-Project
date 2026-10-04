import { defineStore } from 'pinia'
// import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null, loading: false, error: null }),
  actions: {
    /** Restore the session on app start (supabase.auth.getSession) and listen for changes. */
    async init() {
      // TODO(student): implement
    },
    /** @param {string} email @param {string} password */
    async signup(email, password) {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
    /** @param {string} email @param {string} password */
    async login(email, password) {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
    async logout() {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
  },
})
