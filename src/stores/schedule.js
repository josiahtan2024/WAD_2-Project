import { defineStore } from 'pinia'
// import { supabase } from '@/lib/supabase'

export const useScheduleStore = defineStore('schedule', {
  state: () => ({ blocks: [], loading: false, error: null }), // rows from `schedule_blocks`
  actions: {
    /** @param {number|string} universityId Load the user's blocks for this university. */
    async load(universityId) {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
    /** Save the current blocks to Supabase. */
    async save(universityId) {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
  },
})
