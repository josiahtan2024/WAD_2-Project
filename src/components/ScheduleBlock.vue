<script setup>
import { computed,ref } from 'vue';
import { useScheduleStore } from '../stores/schedule';
const props = defineProps({'modules':Array,
'timeSlots':Array,
'weekDays':Array,
'changesDetected':Boolean,
'selectedModule':String,
'mode':String}); //2 modes: view and edit

const emit = defineEmits(['insertModule'])
const selectedDay = ref('');
const startTime = ref(0);
const endTime = ref(0);
const noModuleError = ref(false);
const schedule = useScheduleStore();
const selectedModuleCode = computed(()=>{
  return (schedule.moduleData.find(m => m.module_name == props.selectedModule)).module_code;

})

const startSlot = computed(() =>{ // start of window
  return (day,time) => {
    return day==selectedDay.value && time==startTime.value
  }
})
const midSlot = computed(() =>{ //middle of window
  return (day,time) => {
    return day==selectedDay.value && (time == endTime.value) && startTime.value > 0
  }
})
const endSlot = computed(() =>{ //end of window
  return (day,time) => {
    return (time>startTime.value && time < endTime.value) && day == selectedDay.value
  }
})

function isEditMode(){
  return props.mode.trim()==='edit';
}

function timeString(timeInt){
  let hh = Math.floor(Number(timeInt)/60/60);
  let mm = Math.floor(Number(timeInt)/60%60);
  hh = hh<10?'0'+String(hh):String(hh);
  mm = mm<10?'0'+String(mm):String(mm);
  
  return `${hh}:${mm}`
  
}


function selectLesson(day,time){
  if (!isBlocked(day,time).blocked){
    if (props.selectedModule.trim() != ''){

      if(!startTime.value){ // new selection
        startTime.value = time
        selectedDay.value = day;
        
      } else if (startTime.value && selectedDay.value == day){ 
        
        endTime.value = time;
      }
      
    }else{
      noModuleError.value=true; // set error message to true
      setTimeout(() => {noModuleError.value=false},1500) //disable Error automatically

    }
  }
}

function clearSelection(){
  selectedDay.value='';
  startTime.value=0;
  endTime.value = 0;
}

function addSelection(day,start,end,moduleName){
  if(!(day in schedule.currentSchedule)){
    schedule.currentSchedule[day] = []
  }
  schedule.currentSchedule[day].push({
      moduleName,
      module:selectedModuleCode.value,
      start,
      end
    })
  emit('insertModule')
  clearSelection(); // display greyed out window immediately
  
}
function isBlocked(day,time){
  if(day in schedule.currentSchedule){
    for (let slot of schedule.currentSchedule[day]){
      if (time >= slot.start && time<=slot.end){
        return {blocked:true,mod:(time==slot.start?slot.module:"")}
      }      
    }  
  }
  return {blocked:false,mod:''}
}
</script>

<template>
  <div data-testid="schedule-block">
    <template v-if="startTime > 0 && endTime > 0">
      <div class="schedule-selection rounded-4 p-3 my-3">
        <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div>
            <h2 class="h6 fw-bold mb-1">Current Selection</h2>
            <p class="mb-0"><strong>{{ props.selectedModule }}</strong><span class="mx-2 text-secondary">·</span>{{ selectedDay }}s, {{ timeString(startTime) }}–{{ timeString(endTime) }}</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary" type="button" @click="isEditMode()?clearSelection():$event.stopPropagation()">Clear</button>
            <button class="btn btn-primary" type="button" @click="isEditMode()?addSelection(selectedDay,startTime,endTime,props.selectedModule):$event.stopPropagation()">Add to Schedule</button>
          </div>
        </div>
      </div>
    </template>
    <template v-if="noModuleError">
      <div class="alert alert-warning rounded-4 text-center" role="status">
        No Module selected, please select a Module.
      </div>
    </template>
    <div class="row justify-content-center">
      <div class="col-12 table-responsive schedule-table-wrap rounded-4 p-2 p-md-3">
        <table class="table table-bordered align-middle mb-0 schedule-table">
          <thead>
            <tr class="text-center">
              <th class="px-3 schedule-time-heading" scope="col">Time</th>
              <template v-for="day in props.weekDays" :key="day">
                <th class="px-3" scope="col">{{ day }}</th>
              </template>
            </tr>
          </thead>
          <tbody id="window">
            <template v-for="time in props.timeSlots" :key="time">
              <tr>
                <th class="timing" scope="row">{{ timeString(Number(time)) }}</th>
                <template v-for="day in props.weekDays" :key="day">
                  <td class="slot text-center fw-semibold" :class="{'blocked':isBlocked(day,time).blocked,'disabled':!isEditMode(),'slot-selected':startSlot(day,time) || endSlot(day,time) || midSlot(day,time)}" :role="isEditMode() ? 'button' : undefined" :tabindex="isEditMode() ? 0 : undefined" :aria-label="`${day} ${timeString(Number(time))}${isBlocked(day,time).blocked ? ', occupied' : ', available'}`" @click="isEditMode()?selectLesson(day,time):$event.stopPropagation()" @keydown.enter.prevent="isEditMode() && selectLesson(day,time)" @keydown.space.prevent="isEditMode() && selectLesson(day,time)">
                   {{ isBlocked(day,time).mod }}
                  </td>
                </template>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>


<style scoped>
.schedule-selection {
  background: #f8f9fc;
  border: 1px solid #e8eaf0;
}
.schedule-table-wrap {
  background: #fff;
  border: 1px solid #e8eaf0;
}
.schedule-table {
  min-width: 44rem;
  border-color: #e8eaf0;
}
.schedule-table thead th {
  background: #f8f9fc;
  white-space: nowrap;
}
tbody#window .slot {
  min-width: 5rem;
  height: 2.25rem;
  background: #fff;
  cursor: crosshair;
  transition: background-color .15s ease;
}
tbody#window .slot:hover,
tbody#window .slot:focus-visible {
  background-color: #e8f0ff;
  outline: 2px solid #0d6efd;
  outline-offset: -2px;
}
tbody#window .slot-selected,
tbody#window .slot-selected:hover {
  background-color: #cfe2ff;
}

tbody .timing{
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 5rem;
  background: #f8f9fc;
  color: #495057;
  font-weight: 600;
}

.blocked{
  background-color: #e9ecef !important;
  color: #495057;
  cursor: not-allowed !important;
}
.cross{
  cursor: pointer;
}
.disabled{
  pointer-events:none;
  user-select: none;
}
</style>
