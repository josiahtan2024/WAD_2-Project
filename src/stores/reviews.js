import { defineStore } from 'pinia'
// import { supabase } from '@/lib/supabase'

export const useReviewsStore = defineStore('reviews', {
  state: () => ({ items: [], loading: false, error: null }), // rows from `reviews`
  actions: {
    /** @param {number|string} universityId */
    async load(universityId) {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
    /** @param {number|string} universityId @param {string} body */
    async post(universityId, body) {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
  },
})
