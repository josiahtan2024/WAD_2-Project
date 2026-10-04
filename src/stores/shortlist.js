import { defineStore } from 'pinia'
// import { supabase } from '@/lib/supabase'

export const useShortlistStore = defineStore('shortlist', {
  state: () => ({ items: [], loading: false, error: null }), // rows from `shortlists`
  actions: {
    /** Load the current user's shortlist. */
    async load() {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
    /** @param {number|string} universityId */
    async add(universityId) {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
    /** @param {number|string} universityId */
    async remove(universityId) {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
  },
})
