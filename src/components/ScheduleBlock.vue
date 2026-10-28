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
      <div class="row my-3 mx-auto py-2 justify-content-around bg-warning align-items-center py-1 rounded-1">
        <div class="col-12 text-center">
          <h4>Current selection</h4>
        </div>
        <div class="col-auto"><li class="fs-5 text-success"><strong>{{ props.selectedModule }}</strong> : <u>{{ selectedDay }}s {{ timeString(startTime) }} - {{ timeString(endTime) }}</u></li></div>
        <div class="col-10 col-sm-7 col-md-3 btn-group mt-1">
            <button class=" btn btn-danger" @click="isEditMode()?clearSelection():$event.stopPropagation()">Clear</button>
            <button class="btn btn-success" @click="isEditMode()?addSelection(selectedDay,startTime,endTime,props.selectedModule):$event.stopPropagation()">Add</button>
        </div>
      </div>
    </template>
    <template v-if="noModuleError">
      <div class="alert bg-warning opacity-75 text-center">
        No Module selected, please select a Module.
      </div>
    </template>
    <div class="row justify-content-center">
      <div class="col-lg-10 table-responsive">
        <table class="table border">
          <thead>
            <tr class="text-center">
              <th class="px-3">&nbsp;</th>
              <template v-for="day in props.weekDays" :key="day">
                <th class="px-3">{{ day }}</th>
              </template>
            </tr>
          </thead>
          <tbody id="window">
            <template v-for="time in props.timeSlots" :key="time">
              <tr>
                <td class="timing">{{ timeString(Number(time)) }}</td>
                <template v-for="day in props.weekDays" :key="day">
                  <td class="px-3 slot text-center text-light fw-bold" @click="isEditMode()?selectLesson(day,time):$event.stopPropagation()" style="text-wrap-style: balance;" :class="{'blocked':isBlocked(day,time).blocked,'disabled':!isEditMode(),'bg-info':startSlot(day,time) || endSlot(day,time) || midSlot(day,time)}">
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
/* Optional styling can go here */
tbody#window .slot:hover{
  background-color: #1975feab
;
}
tbody#window .slot:focus{
  background-color: green;
}

tbody .timing{
  position: sticky;
  left: 0;
}

.blocked{
  background-color: grey;
  border: none;
}
.cross{
  cursor: pointer;
}
.disabled{
  pointer-events:none;
  user-select: none;
}
</style>
