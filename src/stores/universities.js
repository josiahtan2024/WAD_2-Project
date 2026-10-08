import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

export const useUniversitiesStore = defineStore('universities', {
  state: () => ({
    items: [], // rows from `universities`
    mappings: [], // rows from `credit_mappings` (joined with smu_modules) for one university
    modules: [], // rows from `smu_modules`
    query: '',
    filters: { region: null, country: null },
    sortBy: 'name',
    loading: false,
    error: null,
  }),
  actions: {
    /** Load all universities from Supabase into `items`. Set loading and error. */
async load() {
  this.loading = true
  this.error = null

  try{
    const { data, error } = await supabase.from('universities').select('*')
    if (error) throw error
    this.items = data ?? []
  } catch (error) {
    this.error = error.message
    throw error
  } finally {
    this.loading = false
  }
},
    /** @param {number|string} universityId Load credit mappings (with SMU module code and name) into `mappings`. */
    async loadMappings(universityId) {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
    /** Load all SMU modules into `modules`. */
    async loadModules() {
      // TODO(student): implement
      throw new Error('Not implemented')
    },
  },
})
