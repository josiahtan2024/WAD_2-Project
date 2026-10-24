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
  state: () => ({ currentSchedule: {}, moduleData:[], loading: false, error: null,studentTimeTableId:null }), // rows from `schedule_blocks`
  actions: {
    /** @param {number|string} universityId Load the user's blocks for this university. */
    serialiseToDb(){
      let insertModuleData =[]
      for(const day in this.currentSchedule){
        for(const slot of this.currentSchedule[day]){
          
          insertModuleData.push({
             timetable_id: this.studentTimeTableId, university_module_id: (this.moduleData.find((m)=> m.module_code == slot.module)).id, day_of_week: day, start_time: slot.start, end_time: slot.end, 
          })
          

          
        }
      }
      return insertModuleData
    },
    async load(uniId,isInitial) {
      // 1. Reset states before fetching
      this.loading = true
      this.error = null

      try {
        // 2. Target the table and filter by universityId
        const { data, error } = await supabase
          .from('timetables')
          .select(`
            id,
            user_id,
            university_id,
            exchange_period_id,
            planned_modules!inner (
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

          if (data.length == 0 || !data){ // Student doesn't have timetable record for shortlisted university
            
            this.loading=false;
            return;
          }
          if(isInitial && this.moduleData.length==0){
            
            this.studentTimeTableId = data[0].id // persistently store the timetableId for future updates
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
    async save(uniId,mode) {
      // applies for both updating existing schedule records & inserting fresh schedule records
      // 1. check if there are existing schedule records, then delete if any
      if (mode=='update'){
        await this.deleteScheduleModules(uniId);
        await this.insertScheduleModules();
      }else if(mode == 'insert'){
        await this.insertTimetable(uniId)
      }
    
      // 2. Insert the currentSchedule record fresh into the database 
    },
    async insertTimetable(uniId){
      let newTimetableRecord = {user_id:currentUserId.value,university_id:uniId}
      let {data,error} = await supabase.from('timetables').insert(newTimetableRecord).select('id').single()
      if(error){
        this.error=error;
      }
      else if(data){
        this.studentTimeTableId= data.id;
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
        const {data,error:insertError} = await supabase
        .from('planned_modules')
        .insert(this.serialiseToDb())
        .select()     
        if (insertError) throw insertError;   
      } catch (error) {
        this.error = error;
        console.log(error)
      }
      
    },
  }
})
