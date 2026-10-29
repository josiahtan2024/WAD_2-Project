import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const currentUserId = computed(() => {
  const user = useAuthStore().user
  if (!user) {return 0}
  return user.id
})



// planned_modules.start_time / end_time are TIME columns ("10:00:00"); the grid works in seconds since midnight (36000)
function secondsToTime(seconds){
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds % 3600 / 60))}:00`
}
function timeToSeconds(time){
  if (typeof time === 'number') return time
  const [h, m, s = 0] = String(time).split(':').map(Number)
  return h * 3600 + m * 60 + s
}

export const useScheduleStore = defineStore('schedule', {
  // one timetable per user per university per exchange period; savedPeriodIds lists the periods that have one
  state: () => ({ currentSchedule: {}, moduleData:[], loading: false, error: null,studentTimeTableId:null,exchangePeriodId:null,universityId:null,savedPeriodIds:[] }), // rows from `schedule_blocks`
  actions: {
    /** @param {number|string} universityId Load the user's blocks for this university. */
    serialiseToDb(){
      let insertModuleData =[]
      for(const day in this.currentSchedule){
        for(const slot of this.currentSchedule[day]){
          
          // match on module_name: it is unique per university, while module_code can repeat (e.g. two "IM" courses)
          const mod = this.moduleData.find((m)=> m.module_name == slot.moduleName)
          insertModuleData.push({
             // each slot points at the student's cart row (cart_modules), which points at the course
             timetable_id: this.studentTimeTableId, cart_module_id: mod.cart_module_id, university_id: this.universityId, user_id: currentUserId.value, day_of_week: day, start_time: secondsToTime(slot.start), end_time: secondsToTime(slot.end),
          })
          

          
        }
      }
      return insertModuleData
    },
    /** Add modules ({ id, module_name, module_code, cart_module_id }) to the pickable list, skipping ones already there. */
    addModules(modules) {
      for (const mod of modules) {
        if (!this.moduleData.some((m) => m.id === mod.id)) {
          this.moduleData.push(mod)
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
    async load(uniId,isInitial,periodId) {
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
        const { data, error } = await supabase
          .from('timetables')
          .select(`
            id,
            user_id,
            university_id,
            exchange_period_id,
            planned_modules (
              id,
              day_of_week,
              start_time,
              end_time,
              cart_modules!inner (
                id,
                university_modules!inner (
                  id,
                  module_name,
                  module_code
                )
              )
            )
          `)
          .eq('user_id', currentUserId.value)
          .eq('university_id', uniId)
          .eq('exchange_period_id', periodId)

          if (error) throw error
          if (!data || data.length == 0){ // Student doesn't have timetable record for shortlisted university
            
            this.loading=false;
            return;
          }
          if(isInitial){

            this.studentTimeTableId = data[0].id // persistently store the timetableId for future updates
            data[0].planned_modules.forEach(mod => {
              const course = mod.cart_modules.university_modules
              if(!this.moduleData.some(i => i.id === course.id)){
                this.moduleData.push({ ...course, cart_module_id: mod.cart_modules.id })
              }
            })
          }
        const lessons = data[0]?.planned_modules || []
        this.currentSchedule = lessons.reduce((acc, lesson) => {
          const day = lesson.day_of_week

          if (!acc[day]) {
            acc[day] = []
          }

          acc[day].push({
            id: lesson.id,
            module: lesson.cart_modules.university_modules.module_code,
            moduleName: lesson.cart_modules.university_modules.module_name,
            start: timeToSeconds(lesson.start_time),
            end: timeToSeconds(lesson.end_time)
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
    async save(uniId,mode,exchangePeriodId) {
      // applies for both updating existing schedule records & inserting fresh schedule records
      // 1. check if there are existing schedule records, then delete if any
      if (mode=='update'){
        await this.deleteScheduleModules(uniId);
        await this.insertScheduleModules();
      }else if(mode == 'insert'){
        await this.insertTimetable(uniId,exchangePeriodId)
      }
    
      // 2. Insert the currentSchedule record fresh into the database 
    },
    async insertTimetable(uniId,exchangePeriodId){
      // every timetable belongs to one exchange period (timetables.exchange_period_id is NOT NULL)
      let newTimetableRecord = {user_id:currentUserId.value,university_id:uniId,exchange_period_id:exchangePeriodId}
      let {data,error} = await supabase.from('timetables').insert(newTimetableRecord).select('id').single()
      if(error){
        this.error=error.message;
      }
      else if(data){
        this.studentTimeTableId= data.id;
        this.exchangePeriodId = exchangePeriodId;
        this.savedPeriodIds.push(exchangePeriodId);
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
        this.error = 'Failed to delete planned modules:'+ deleteError.message
       
      }
    },
    async insertScheduleModules(){
      try {
        const {error:insertError} = await supabase
        .from('planned_modules')
        .insert(this.serialiseToDb())
        .select()     
        if (insertError) throw insertError;   
      } catch (error) {
        this.error = error.message;
        console.log(error)
      }
      
    },
  }
})
