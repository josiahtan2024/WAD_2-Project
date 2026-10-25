import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'



// One credit_mappings row with its SMU course area and the foreign (partner university) module.
const MAPPING_SELECT = `
  id,
  notes,
  smu_module:smu_modules ( id, course_area, school, description ),
  university_module:university_modules!inner ( id, university_id, module_name, module_code, description, language )
`
// Supabase returns at most 1000 rows per request, so larger tables are fetched in pages.
const PAGE_SIZE = 1000


export const useUniversitiesStore = defineStore('universities', {
  state: () => ({
    items: [], // rows from `universities`
    mappings: [], // rows from `credit_mappings` (joined with smu_modules) for one university
    allMappings: [], // rows from `credit_mappings` across every university (course search page)
    modules: [], // rows from `smu_modules`
    query: '',
    filters: { region: null, country: null },
    sortBy: 'name',
    loading: false,
    error: null,
    scheduleUniName:null,
  }),
  actions: {
    /** Load all universities from Supabase into `items`. Set loading and error. */
    async load() {
      this.loading = true
      this.error = null

      try {
        const { data, error } = await supabase
          .from('universities')
          .select(`
            *,
            university_costs (
              currency_code,
              accommodation,
              food,
              transport,
              personal_expenses
            )
          `)
        if (error) throw error
        this.items = data ?? []
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /** @param {number|string} universityId Load credit mappings (with SMU course area) into `mappings`. */
    async loadMappings(universityId) {
      const { data, error } = await supabase
        .from('credit_mappings')
        .select(MAPPING_SELECT)
        .eq('university_module.university_id', universityId)
        .order('id', { ascending: true })
      if (error) throw error
      this.mappings = data ?? []
    },

    /** Load credit mappings for every university into `allMappings`. */
    async loadAllMappings() {
      const rows = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('credit_mappings')
          .select(MAPPING_SELECT)
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        rows.push(...(data ?? []))
        if (!data || data.length < PAGE_SIZE) break
      }
      this.allMappings = rows
    },

    /** Load all SMU course areas into `modules`. */
    async loadModules() {
      const { data, error } = await supabase
        .from('smu_modules')
        .select('id, course_area, school, description')
        .order('course_area', { ascending: true })
      if (error) throw error
      this.modules = data ?? []
    },

    async getUniversityName(universityId){
      try {
        const {data,error} = await supabase.from('universities').select('name').eq('id',universityId)
        
        this.scheduleUniName= data[0].name
      } catch (error) {
        
      }
    }

  },
})
