import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const currentUserId = computed(() => {
  const user = useAuthStore().user
  if (!user) {return 0}
  return user.id
})
  


export const useScheduleStore = defineStore('schedule', {
  state: () => ({ currentSchedule: {}, moduleData:[], loading: false, error: null,studentTimeTableId:null,exchangePeriodId:null }), // rows from `schedule_blocks`
  actions: {
    /** @param {number|string} universityId Load the user's blocks for this university. */
    serialiseToDb(){
      let insertModuleData =[]
      for(const day in this.currentSchedule){
        for(const slot of this.currentSchedule[day]){
          
          insertModuleData.push({
             // match on module_name: it is unique per university, while module_code can repeat (e.g. two "IM" courses)
             timetable_id: this.studentTimeTableId, university_module_id: (this.moduleData.find((m)=> m.module_name == slot.moduleName)).id, day_of_week: day, start_time: slot.start, end_time: slot.end,
          })
          

          
        }
      }
      return insertModuleData
    },
    /** Add modules ({ id, module_name, module_code }) to the pickable list, skipping ones already there. */
    addModules(modules) {
      for (const mod of modules) {
        if (!this.moduleData.some((m) => m.id === mod.id)) {
          this.moduleData.push(mod)
        }
      }
    },
    async load(uniId,isInitial) {
      // 1. Reset states before fetching
      this.loading = true
      this.error = null
      if (isInitial) {
        // Opening a schedule page: drop anything left over from a previously viewed university
        this.moduleData = []
        this.currentSchedule = {}
        this.studentTimeTableId = null
        this.exchangePeriodId = null
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
              university_modules!inner (
                id,
                module_name,
                module_code
              )
            )
          `)
          .eq('user_id', currentUserId.value)
          .eq('university_id', uniId)

          if (error) throw error
          if (!data || data.length == 0){ // Student doesn't have timetable record for shortlisted university
            
            this.loading=false;
            return;
          }
          if(isInitial){

            this.studentTimeTableId = data[0].id // persistently store the timetableId for future updates
            this.exchangePeriodId = data[0].exchange_period_id
            data[0].planned_modules.forEach(mod => {
              if(!this.moduleData.some(i => i.id === mod.university_modules.id)){
                this.moduleData.push(mod.university_modules)
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
            module: lesson.university_modules.module_code,
            moduleName: lesson.university_modules.module_name,
            start: lesson.start_time,
            end: lesson.end_time
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
        if (exchangePeriodId && exchangePeriodId != this.exchangePeriodId){
          await this.updateExchangePeriod(exchangePeriodId)
        }
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
        await this.insertScheduleModules()
      }
    },
    async updateExchangePeriod(exchangePeriodId){
      // the student picked a different exchange period for an existing timetable
      const { error } = await supabase
        .from('timetables')
        .update({ exchange_period_id: exchangePeriodId })
        .eq('id', this.studentTimeTableId)
      if (error) {
        this.error = 'Failed to update exchange period:'+ error.message
      } else {
        this.exchangePeriodId = exchangePeriodId
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
        const {data,error:insertError} = await supabase
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
