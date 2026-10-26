import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'

// The cart is kept in localStorage per logged-in user until scheduling saves it to `planned_modules`.
// Logged-out visitors can search courses but have no cart.
function storageKey() {
  const userId = useAuthStore().user?.id
  return userId ? `courseCart:${userId}` : null
}

/**
 * Cart item shape (shared with the scheduling feature):
 * { universityModuleId, universityId, moduleName, moduleCode, language, smuModuleId, courseArea, smuDescription }
 */
export const useCourseCartStore = defineStore('courseCart', {
  state: () => ({ items: [] }),
  getters: {
    /** @returns {(universityModuleId: number) => boolean} */
    has: (state) => (universityModuleId) =>
      state.items.some((item) => item.universityModuleId === universityModuleId),
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
    /** Read the current user's cart from localStorage. Call on app start and when the user changes. */
    load() {
      const key = storageKey()
      if (!key) {
        this.items = []
        return
      }
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? '[]')
        this.items = Array.isArray(saved) ? saved : []
      } catch {
        this.items = []
      }
    },
    persist() {
      const key = storageKey()
      if (!key) return
      try {
        localStorage.setItem(key, JSON.stringify(this.items))
      } catch {
        // Storage can be unavailable (private mode); the cart still works for this visit.
      }
    },
    /** @param {object} mapping A credit_mappings row loaded with MAPPING_SELECT. */
    add(mapping) {
      if (!useAuthStore().user) throw new Error('Log in to add courses to your cart')
      const um = mapping.university_module
      if (this.has(um.id)) return
      this.items.push({
        universityModuleId: um.id,
        universityId: um.university_id,
        moduleName: um.module_name,
        moduleCode: um.module_code ?? '',
        language: um.language,
        smuModuleId: mapping.smu_module?.id ?? null,
        courseArea: mapping.smu_module?.course_area ?? '',
        smuDescription: mapping.smu_module?.description ?? '',
      })
      this.persist()
    },
    /** @param {number} universityModuleId */
    remove(universityModuleId) {
      this.items = this.items.filter((item) => item.universityModuleId !== universityModuleId)
      this.persist()
    },
    /** @param {number} [universityId] Clear one university's items, or the whole cart when omitted. */
    clear(universityId) {
      this.items = universityId == null
        ? []
        : this.items.filter((item) => item.universityId !== Number(universityId))
      this.persist()
    },
  },
})
