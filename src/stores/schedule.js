import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const currentUserId = computed(() => {
  const user = useAuthStore().user
  if (!user) {
    return 0
  }
  return user.id
})

// planned_modules.start_time / end_time are TIME columns ("10:00:00"); the grid works in seconds since midnight (36000)
function secondsToTime(seconds) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:00`
}
function timeToSeconds(time) {
  if (typeof time === 'number') return time
  const [h, m, s = 0] = String(time).split(':').map(Number)
  return h * 3600 + m * 60 + s
}

export const useScheduleStore = defineStore('schedule', {
  // one timetable per user per university per exchange period; savedPeriodIds lists the periods that have one
  state: () => ({
    currentSchedule: {},
    moduleData: [],
    loading: false,
    error: null,
    studentTimeTableId: null,
    exchangePeriodId: null,
    universityId: null,
    savedPeriodIds: [],
  }), // rows from `schedule_blocks`
  actions: {
    /** @param {number|string} universityId Load the user's blocks for this university. */
    resetStore() {
      this.currentSchedule = {}
      this.studentTimeTableId = null
      this.exchangePeriodId = null
      this.error = null
    },
    serialiseToDb() {
      let insertModuleData = []
      for (const day in this.currentSchedule) {
        for (const slot of this.currentSchedule[day]) {
          // match on module_name: it is unique per university, while module_code can repeat (e.g. two "IM" courses)
          const mod = this.moduleData.find((m) => m.module_name == slot.moduleName)
          insertModuleData.push({
            // Keep the course identity independent of whether its cart row still exists.
            timetable_id: this.studentTimeTableId,
            university_module_id: mod.id,
            cart_module_id: mod.cart_module_id ?? null,
            university_id: this.universityId,
            user_id: currentUserId.value,
            day_of_week: day,
            start_time: secondsToTime(slot.start),
            end_time: secondsToTime(slot.end),
          })
        }
      }
      return insertModuleData
    },
    /** Add modules to the pickable list and refresh any available cart reference. */
    addModules(modules) {
      for (const mod of modules) {
        const existingModule = this.moduleData.find((item) => item.id === mod.id)
        if (!existingModule) {
          this.moduleData.push(mod)
        } else if (mod.cart_module_id != null) {
          existingModule.cart_module_id = mod.cart_module_id
        }
      }
    },
    /** @param {number|string} uniId Load which exchange periods already have a saved timetable for this university. */
    async loadSavedPeriods(uniId) {
      const { data, error } = await supabase
        .from('timetables')
        .select('exchange_period_id')
        .eq('user_id', currentUserId.value)
        .eq('university_id', uniId)
      if (error) throw error
      this.savedPeriodIds = (data ?? []).map((t) => t.exchange_period_id)
    },
    async load(uniId, isInitial, periodId) {
      // 1. Reset states before fetching
      this.loading = true
      this.error = null
      if (isInitial) {
        // Opening a timetable: drop anything left over from a previously viewed university or period
        this.moduleData = []
        this.currentSchedule = {}
        this.studentTimeTableId = null
        this.exchangePeriodId = Number(periodId)
        this.universityId = Number(uniId)
      }

      try {
        // 2. Target the table and filter by universityId
        let { data, error } = await supabase
          .from('timetables')
          .select(
            `
            id,
            user_id,
            university_id,
            exchange_period_id,
            planned_modules (
              id,
              university_module_id,
              cart_module_id,
              day_of_week,
              start_time,
              end_time
            )
          `
          )
          .eq('user_id', currentUserId.value)
          .eq('university_id', uniId)
          .eq('exchange_period_id', periodId)

        // Existing databases may not have the stable course ID column until
        // preserve-saved-schedules.sql has been applied. Fall back to the
        // cart reference so users can still open their existing schedules.
        const missingStableCourseColumn =
          error?.code === '42703' ||
          error?.message?.includes('planned_modules.university_module_id') ||
          error?.message?.includes('planned_modules_1.university_module_id')
        let usesLegacyCartReference = false
        if (missingStableCourseColumn) {
          usesLegacyCartReference = true
          const legacyResult = await supabase
            .from('timetables')
            .select(
              `
              id,
              user_id,
              university_id,
              exchange_period_id,
              planned_modules (
                id,
                cart_module_id,
                day_of_week,
                start_time,
                end_time
              )
            `
            )
            .eq('user_id', currentUserId.value)
            .eq('university_id', uniId)
            .eq('exchange_period_id', periodId)
          data = legacyResult.data
          error = legacyResult.error
        }

        if (error) throw error
        if (!data || data.length === 0) {
          // A new, unsaved schedule has no row to reload. Clear locally added modules.
          this.currentSchedule = {}
          this.studentTimeTableId = null
          return
        }

        // Load course details separately instead of relying on PostgREST to
        // resolve the planned_modules -> university_modules relationship.
        const plannedModules = data[0].planned_modules || []
        const cartModuleIds = [
          ...new Set(plannedModules.map((mod) => mod.cart_module_id).filter(Boolean)),
        ]
        let moduleIdByCartId = new Map()
        if (usesLegacyCartReference && cartModuleIds.length) {
          const { data: cartModules, error: cartError } = await supabase
            .from('cart_modules')
            .select('id, university_module_id')
            .in('id', cartModuleIds)
          if (cartError) throw cartError
          moduleIdByCartId = new Map(
            (cartModules ?? []).map((item) => [item.id, item.university_module_id])
          )
        }
        const moduleIds = [
          ...new Set(
            plannedModules
              .map((mod) => mod.university_module_id ?? moduleIdByCartId.get(mod.cart_module_id))
              .filter(Boolean)
          ),
        ]
        let coursesById = new Map()
        if (moduleIds.length) {
          const { data: courses, error: coursesError } = await supabase
            .from('university_modules')
            .select('id, module_name, module_code')
            .eq('university_id', uniId)
            .in('id', moduleIds)
          if (coursesError) throw coursesError
          coursesById = new Map((courses ?? []).map((course) => [course.id, course]))
        }

        if (isInitial) {
          this.studentTimeTableId = data[0].id // persistently store the timetableId for future updates
          plannedModules.forEach((mod) => {
            const moduleId =
              mod.university_module_id ?? moduleIdByCartId.get(mod.cart_module_id)
            const course = coursesById.get(moduleId)
            if (!course) return
            if (!this.moduleData.some((i) => i.id === course.id)) {
              this.moduleData.push({ ...course, cart_module_id: mod.cart_module_id })
            }
          })
        }
        this.currentSchedule = plannedModules.reduce((acc, lesson) => {
          const day = lesson.day_of_week
          const moduleId =
            lesson.university_module_id ?? moduleIdByCartId.get(lesson.cart_module_id)
          const course = coursesById.get(moduleId)
          if (!course) return acc

          if (!acc[day]) {
            acc[day] = []
          }

          acc[day].push({
            id: lesson.id,
            module: course.module_code,
            moduleName: course.module_name,
            start: timeToSeconds(lesson.start_time),
            end: timeToSeconds(lesson.end_time),
          })

          return acc
        }, {})
      } catch (err) {
        this.error = err.message
        console.error('Failed to load schedule:', err.message)
      } finally {
        // 5. Disable the loading spinner state
        this.loading = false
      }
    },
    /** Save the current blocks to Supabase. */
    async save(uniId, mode, exchangePeriodId) {
      const rows = this.serialiseToDb()
      const moduleIds = rows.map((row) => row.university_module_id)
      if (new Set(moduleIds).size !== moduleIds.length) {
        this.error = 'A module is already in this schedule. Each module can only be added once.'
        return
      }

      // applies for both updating existing schedule records & inserting fresh schedule records
      // 1. check if there are existing schedule records, then delete if any
      if (mode == 'update') {
        await this.deleteScheduleModules(uniId)
        await this.insertScheduleModules()
      } else if (mode == 'insert') {
        await this.insertTimetable(uniId, exchangePeriodId)
      }

      // 2. Insert the currentSchedule record fresh into the database
    },
    /** Delete one saved timetable for this user, university, and exchange period. */
    async deleteForPeriod(uniId, exchangePeriodId) {
      const { data, error } = await supabase
        .from('timetables')
        .delete()
        .eq('user_id', currentUserId.value)
        .eq('university_id', uniId)
        .eq('exchange_period_id', exchangePeriodId)
        .select('id, exchange_period_id')

      if (error) throw error

      this.savedPeriodIds = this.savedPeriodIds.filter(
        (periodId) => periodId !== Number(exchangePeriodId)
      )
      this.currentSchedule = {}
      this.studentTimeTableId = null
      this.exchangePeriodId = null
      this.universityId = Number(uniId)
      return data?.length ?? 0
    },
    async insertTimetable(uniId, exchangePeriodId) {
      // every timetable belongs to one exchange period (timetables.exchange_period_id is NOT NULL)
      let newTimetableRecord = {
        user_id: currentUserId.value,
        university_id: uniId,
        exchange_period_id: exchangePeriodId,
      }
      let { data, error } = await supabase
        .from('timetables')
        .insert(newTimetableRecord)
        .select('id')
        .single()
      if (error) {
        this.error = error.message
      } else if (data) {
        this.studentTimeTableId = data.id
        this.exchangePeriodId = exchangePeriodId
        this.savedPeriodIds.push(exchangePeriodId)
        await this.insertScheduleModules()
      }
    },
    async deleteScheduleModules() {
      //Delete all planned modules linked to this timetable_id
      const { error: deleteError } = await supabase
        .from('planned_modules')
        .delete()
        .eq('timetable_id', this.studentTimeTableId)

      if (deleteError) {
        this.error = 'Failed to delete planned modules:' + deleteError.message
      }
    },
    async insertScheduleModules() {
      try {
        const { error: insertError } = await supabase
          .from('planned_modules')
          .insert(this.serialiseToDb())
          .select()
        if (insertError) throw insertError
      } catch (error) {
        this.error =
          error.code === '23505' &&
          error.message?.includes('planned_modules_timetable_id_university_module_id_key')
            ? 'A module is already in this schedule. Each module can only be added once.'
            : error.message
        console.log(error)
      }
    },
  },
})
