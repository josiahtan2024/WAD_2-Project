import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useUniversitiesStore } from '@/stores/universities'

function getUserId() {
  const user = useAuthStore().user
  if (!user) {throw new Error('User not logged in')}
  return user.id
}
  
export const useShortlistStore = defineStore('shortlist', {
  state: () => ({ items: [], loading: false, saving: false, error: null }),
  actions: {
    async load() {
      this.loading = true
      this.error = null
      try {
        const userId = getUserId()
        const { data, error } = await supabase
          .from('shortlists')
          .select('id, user_id,university_id')
          .eq('user_id', userId)
          .order('id', { ascending: true })
        if (error) throw error
        if(useAuthStore().user?.id !== userId)return
        this.items= data??[]}catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },
    /** @param {number|string} universityId */
    async add(universityId) {
      if(this.saving) return
      this.saving = true
      this.error = null
      try {
        const userId = getUserId()
        const auth = useAuthStore()
        const university = useUniversitiesStore().items.find((item) => item.id === universityId)
        if (!auth.adminActive && university?.published === false) {
          throw new Error('This university is hidden from students and cannot be shortlisted.')
        }
        const { data, error } = await supabase
          .from('shortlists')
          .insert({ user_id: userId, university_id: universityId })
          .select('id, user_id, university_id')
          .single()
        if(useAuthStore().user?.id !== userId)return
        if (error?.code === '23505') {
          await this.load()
          return}
        if (error) throw error
        if (!this.items.some((item) => item.id === data.id)) {
          this.items.push(data)
        }
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.saving = false
      }
    },
    /** @param {number|string} universityId */
    async remove(universityId) {
      if(this.saving) return
      this.saving = true
      this.error = null
      try {
        const userId = getUserId()
        const { data, error } = await supabase
          .from('shortlists')
          .delete()
          .eq('user_id', userId)
          .eq('university_id', universityId)
          .select('id')
        if(error) throw error
        if(useAuthStore().user?.id !== userId)return
        if (!data?.length){
          throw new Error('No item found to remove')
        }
        this.items = this.items.filter((item) => item.university_id !== universityId)
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.saving = false
      }
    },
  },
})
