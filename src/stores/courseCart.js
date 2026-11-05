import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

// One cart_modules row with its course and the SMU course area it maps to.
const CART_SELECT = `
  id,
  university_id,
  university_module:university_modules (
    id, module_name, module_code, language,
    credit_mappings ( smu_module:smu_modules ( id, course_area, description ) )
  )
`

// Shared by every caller of ensureLoaded() while one load is in flight
let loadPromise = null

function getUserId() {
  const user = useAuthStore().user
  if (!user) throw new Error('Log in to use your cart')
  return user.id
}

/**
 * Narrow a planned_modules query to the user's timeslots that use some of their cart rows.
 * @param {object} query A supabase.from('planned_modules') select or delete.
 * @param {{ cartModuleIds?: number[], universityId?: number|string }} scope cart rows by id, or every row for one university, or (empty) the whole cart
 */
function plannedSlots(query, { cartModuleIds, universityId } = {}) {
  query = query.eq('user_id', getUserId())
  if (cartModuleIds) query = query.in('cart_module_id', cartModuleIds)
  if (universityId != null) query = query.eq('university_id', universityId)
  return query
}

// A course's timeslots go with it when it leaves the cart, so a schedule never points at a removed course.
// The database also cascades this (planned_modules -> cart_modules ON DELETE CASCADE); deleting here first
// keeps it working on a database set up before that cascade was added.
async function deletePlannedSlots(scope) {
  const { error } = await plannedSlots(supabase.from('planned_modules').delete(), scope)
  if (error) throw error
}

/** Narrow a timetables query to the user's saved schedules, for one university or (omitted) all of them. */
function savedSchedules(query, universityId) {
  query = query.eq('user_id', getUserId())
  if (universityId != null) query = query.eq('university_id', universityId)
  return query
}

/** Turn a cart_modules row into the cart item shape used by the pages. */
function toItem(row) {
  const um = row.university_module
  const smu = um?.credit_mappings?.[0]?.smu_module
  return {
    cartModuleId: row.id,
    universityModuleId: um?.id,
    universityId: row.university_id,
    moduleName: um?.module_name ?? '',
    moduleCode: um?.module_code ?? '',
    language: um?.language ?? null,
    smuModuleId: smu?.id ?? null,
    courseArea: smu?.course_area ?? '',
    smuDescription: smu?.description ?? '',
  }
}

/**
 * The cart lives in Supabase (`cart_modules`), one row per course per student; logged-out visitors have no cart.
 * Cart item shape (shared with the scheduling feature):
 * { cartModuleId, universityModuleId, universityId, moduleName, moduleCode, language, smuModuleId, courseArea, smuDescription }
 */
export const useCourseCartStore = defineStore('courseCart', {
  state: () => ({
    items: [],
    maxLimit: 10, // business rule: a student maps no more than 10 modules per exchange university
    loadedUserId: null, // whose cart `items` holds
    pendingIds: [], // universityModuleIds being added or removed (disables their buttons)
    loading: false,
    error: null,
  }),
  getters: {
    /** @returns {(universityModuleId: number) => boolean} */
    has: (state) => (universityModuleId) =>
      state.items.some((item) => item.universityModuleId === universityModuleId),
    /** @returns {(universityModuleId: number) => boolean} */
    isPending: (state) => (universityModuleId) => state.pendingIds.includes(universityModuleId),
    /** @returns {(universityId: number|string) => object[]} Cart items for one university, for scheduling. */
    forUniversity: (state) => (universityId) =>
      state.items.filter((item) => item.universityId === Number(universityId)),
    /** Cart items grouped as { [universityId]: items[] }. */
    byUniversity: (state) =>
      state.items.reduce((groups, item) => {
        ;(groups[item.universityId] ??= []).push(item)
        return groups
      }, {}),
  },
  actions: {
    /** Load the current user's cart from Supabase. Called on app start and whenever the user changes. */
    load() {
      const userId = useAuthStore().user?.id ?? null
      this.error = null
      if (!userId) {
        this.items = []
        this.loadedUserId = null
        return Promise.resolve()
      }
      loadPromise = (async () => {
        this.loading = true
        try {
          const { data, error } = await supabase
            .from('cart_modules')
            .select(CART_SELECT)
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
          if (error) throw error
          if (useAuthStore().user?.id !== userId) return // user changed while loading
          this.items = (data ?? []).map(toItem)
          this.loadedUserId = userId
        } catch (error) {
          this.error = error.message
        } finally {
          this.loading = false
          loadPromise = null
        }
      })()
      return loadPromise
    },
    /** Make sure `items` holds the current user's cart (pages call this before reading it). */
    async ensureLoaded() {
      const userId = useAuthStore().user?.id ?? null
      if (loadPromise) await loadPromise
      if (this.loadedUserId !== userId) await this.load()
    },
    /**
     * How many saved schedule timeslots would be deleted along with this cart item (pages ask before removing).
     * @param {number} universityModuleId
     */
    async scheduledSlotCount(universityModuleId) {
      const item = this.items.find((i) => i.universityModuleId === universityModuleId)
      if (!item) return 0
      const { count, error } = await plannedSlots(
        supabase.from('planned_modules').select('id', { count: 'exact', head: true }),
        { cartModuleIds: [item.cartModuleId] }
      )
      if (error) throw error
      return count ?? 0
    },
    /**
     * How many saved schedules (timetables) clearing the cart would delete (pages ask before clearing).
     * @param {number|string} [universityId] One university, or omit for every university.
     */
    async savedScheduleCount(universityId) {
      const { count, error } = await savedSchedules(
        supabase.from('timetables').select('id', { count: 'exact', head: true }),
        universityId
      )
      if (error) throw error
      return count ?? 0
    },
    /** @param {object} mapping A credit_mappings row loaded with MAPPING_SELECT. */
    async add(mapping) {
      const um = mapping.university_module
      if (this.has(um.id) || this.isPending(um.id)) return
      this.error = null
      this.pendingIds.push(um.id)
      try {
        const userId = getUserId()
        const { data, error } = await supabase
          .from('cart_modules')
          .insert({ user_id: userId, university_module_id: um.id, university_id: um.university_id })
          .select(CART_SELECT)
          .single()
        if (error) throw error
        if (useAuthStore().user?.id !== userId) return
        this.items.push(toItem(data))
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.pendingIds = this.pendingIds.filter((id) => id !== um.id)
      }
    },
    /** @param {number} universityModuleId */
    async remove(universityModuleId) {
      const item = this.items.find((i) => i.universityModuleId === universityModuleId)
      if (!item || this.isPending(universityModuleId)) return
      this.error = null
      this.pendingIds.push(universityModuleId)
      try {
        await deletePlannedSlots({ cartModuleIds: [item.cartModuleId] })
        const { error } = await supabase
          .from('cart_modules')
          .delete()
          .eq('id', item.cartModuleId)
          .eq('user_id', getUserId())
        if (error) throw error
        this.items = this.items.filter((i) => i.cartModuleId !== item.cartModuleId)
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.pendingIds = this.pendingIds.filter((id) => id !== universityModuleId)
      }
    },
    /**
     * Clear one university's items, or the whole cart when omitted. With no courses left there is nothing
     * to schedule, so that university's saved schedules (every exchange period) are deleted as well.
     * @param {number} [universityId]
     */
    async clear(universityId) {
      this.error = null
      try {
        await deletePlannedSlots({ universityId })
        const { error: scheduleError } = await savedSchedules(supabase.from('timetables').delete(), universityId)
        if (scheduleError) throw scheduleError
        let query = supabase.from('cart_modules').delete().eq('user_id', getUserId())
        if (universityId != null) query = query.eq('university_id', universityId)
        const { error } = await query
        if (error) throw error
        this.items =
          universityId == null
            ? []
            : this.items.filter((item) => item.universityId !== Number(universityId))
      } catch (error) {
        this.error = error.message
        throw error
      }
    },
  },
})
