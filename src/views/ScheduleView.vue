<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import { useScheduleStore } from '@/stores/schedule'
import { useUniversitiesStore } from '@/stores/universities'
import ScheduleBlock from '@/components/ScheduleBlock.vue';
import InstructionAlert from '@/components/InstructionAlert.vue';

const route = useRoute()
const schedule = useScheduleStore()
const uni = useUniversitiesStore()
const saving = ref(false)
const discarding = ref(false);
const saved = ref(false)
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const timeLimit = [28800,64800] // 8am to 6pm in seconds
const timeSlots = ref ([]);
const deleteModules = ref([]);
const deleteStatus = ref(false);
const selectedModule = ref('');
const hasSchedule = ref(false);
const editSchedule = ref(false);
const showGrid = ref(false)
const changesMade = ref(false)
const instructionsInsert = ['Select a Module','Select the Start Time and End Time on the Grid',"Click 'Add' and repeat for next module"];
const instructionsDelete = ['Select your Module(s)',"Click 'Delete from Schedule'","If updating module timings: Repeat Steps 1 and 2 under Insert/Update Modules"];

async function save() {
  saving.value = true
  saved.value = false
  schedule.error = null
  const mode = hasSchedule.value?'update':'insert';
  try {
    await schedule.save(route.params.universityId,mode);
    saved.value = true
    if(!schedule.error){
      changesMade.value = false; // hide the bar 
    }
  } catch (e) {
    schedule.error = e.message
  } finally {
    saving.value = false
  }
}
function loadTimeSlots() {
  let ts = []
  for(let t = timeLimit[0];t<timeLimit[1]+1;t+=1800){
    ts.push(t);
  }
  return ts;
}
function openScheduleBlock(){
  editSchedule.value=true;
  setTimeout(()=> {showGrid.value=true;},1500);
}
function removeModules(){

  for (const day in schedule.currentSchedule) {  
    schedule.currentSchedule[day] = schedule.currentSchedule[day].filter((mod) => !deleteModules.value.includes(mod.moduleName) )

  }
  deleteStatus.value = !deleteStatus.value; //change button status text to 'deleting'

  setTimeout(() =>{
    deleteStatus.value = !deleteStatus.value; // revert button status to normal
  },1000)
  changesMade.value=true;
  deleteModules.value=[];
  
}

function checkScheduleModule(modName){
  for (const day in schedule.currentSchedule) {
    let record = schedule.currentSchedule[day].find(lesson => lesson.moduleName === modName)
    if (record) {
      return record;
    }
  }
  return false;
}
async function discardChange(){
  await schedule.load(route.params.universityId,false) // reset the currentSchedule record
  discarding.value=!discarding.value; // show discarding text
  changesMade.value=false;
  discarding.value=!discarding.value; // revert to original button form

}

onMounted(async () => {
  try {
    //await uni.loadMappings(route.params.universityId)
    
    await uni.getUniversityName(route.params.universityId)
    await schedule.load(route.params.universityId,true)
    hasSchedule.value = Object.keys(schedule.currentSchedule).length > 0;
    timeSlots.value = loadTimeSlots()
    

  } catch (e) {
    schedule.error = e.message
    console.log(schedule.error)
  }
})

</script>

<template>
  <section data-testid="schedule-page">
    <div class="card top-0 z-3" :class="{'position-sticky':changesMade}">
      <div class="card-body align-items-center">
        <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 class="h3 mb-0">Weekly schedule : {{ uni.scheduleUniName || "" }}</h1>
        <template v-if="changesMade">
        <div class="changes-pill">

        
        <button class="btn btn-danger" :disabled="discarding" data-testid="schedule-save-btn" @click="discardChange()">
          {{ discarding ? 'Discarding..' : 'Discard Changes' }}
        </button>
        <button class="btn btn-primary" :disabled="saving" data-testid="schedule-save-btn" @click="save()">
          {{ saving ? 'Saving...' : 'Save schedule' }}
        </button>
        </div>
        </template>
        </div>
      </div>
    </div>
    <div v-if="schedule.error" class="alert alert-danger" data-testid="schedule-error">{{ schedule.error }}</div>
    <div v-if="saved" class="alert alert-success" data-testid="schedule-saved">Schedule saved.</div>
    <div v-if="schedule.loading" class="text-muted" data-testid="schedule-loading">Loading schedule...</div>

    <div class="row g-3">
      <div class="col-12 col-lg-3">
        <h6 class="h6">Mapped modules</h6>
        
      </div>
      <template v-if="!uni.mappings.length">
        <div class="card">
          <div class="card-body d-flex flex-wrap justify-content-between">

            <div class="d-inline-block ">
              <p  class="text-muted m-0" data-testid="schedule-no-modules">No Exchange modules mapped for this university.</p>
            </div>
            <div class="d-inline-block mt-2 mt-sm-0">
              <a class="w-100 text-underline" :href='`/map-exchange-module/${route.params.universityId}`'>Map Exchange Modules</a>
            </div>
          </div>
          
        </div>

      </template>

    </div>


    <div class="container-fluid">
  

    <template v-if="hasSchedule">
      <div class="row justify-content-center">

        <div class="btn-group w-50 my-3" role="group" aria-label="Basic radio toggle button group">
          <input type="radio" class="btn-check" id="view" autocomplete="off" :checked="!editSchedule" @click="editSchedule=!editSchedule">
          <label class="btn btn-outline-info w-20" for="view">View Schedule</label>
          
          
          <input type="radio" class="btn-check" id="edit"autocomplete="off" :checked="editSchedule" @click="editSchedule=!editSchedule">
          <label class="btn btn-outline-dark w-20 " for="edit">Edit Schedule</label>
          
          
        </div>
      </div>
      
     </template>
    <template v-else-if="!hasSchedule && !showGrid">
        <div class="alert alert-info row justify-content-between align-items-center w-75 mx-auto" role="alert">
          <div class="col-md-8 text-center p-1">
            You have no schedules planned for this university.
          </div>
          <div class="btn btn-outline-info col-md-3" id="create-schedule-btn" @click="openScheduleBlock()">
            
            {{editSchedule?'Loading..':'New Schedule'}}
          </div>
          
        </div>
    </template>
    <template>
       <button class="btn btn-danger" data-testid="schedule-save-btn" @click="discardChange">
        Discard Changes
      </button>
      <button class="btn btn-primary" :disabled="saving" data-testid="schedule-save-btn" @click="save">
        {{ saving ? 'Saving...' : 'Save schedule' }}
      </button>
    </template>
    <template v-if="showGrid">

      <InstructionAlert action="Insert" color="info"  :instructions="instructionsInsert" @select-mod="onSelectMod()" id="instructionSelect">
        <template v-slot:form>
          <div class="row justify-content-center">
            
              <template v-for="mod in schedule.moduleData" :key="mod.id">
                <div class="col-6 col-sm-2 col-lg-1  m-1">
                  
                  <input type="radio" :value="mod.module_name" class = 'btn-check' :id="`${mod.id}-1`" v-model="selectedModule">
                  <label class= 'btn btn-outline-dark w-100 px-1' :for="`${mod.id}-1`" >{{ mod.module_code }}
                  </label>
                </div>
              </template>
            
          </div>
        </template>

      </InstructionAlert>
      <ScheduleBlock :modules="schedule.moduleData" :time-slots="timeSlots" :week-days="weekDays" :selected-module="selectedModule" mode="edit" @insertModule="changesMade=true"></ScheduleBlock>

    </template>
    <template v-if="editSchedule && hasSchedule">
      <InstructionAlert action="Delete"  color="danger"  :instructions="instructionsDelete" id="instructionDelete">
        <template v-slot:form>
          <div class="row justify-content-center mb-1">
            

              <template v-for="mod in schedule.moduleData">
                <div class="m-2 m-md-0 col-12 col-md-2 text-center align-items-center">
                  <input type="checkbox" :value="mod.module_name" class="form-check-input" :id="`${mod.id}-2`" v-model="deleteModules" :disabled="!checkScheduleModule(mod.module_name)">
                  
                  <label class= 'px-1 form-check-label' :for="`${mod.id}-2`"  >{{ mod.module_code }}</label>
                </div>
              </template>
            
          </div>
          <div class="row justify-content-center mt-3">
            <div class="col-6 col-md-4">
              <button class="btn btn-outline-danger w-100" @click="removeModules()"> {{ !deleteStatus?"Delete from Schedule":"Deleting.."  }}</button>
            </div>
          </div>

        </template>
      </InstructionAlert>
      <InstructionAlert action="Insert/Update" :modules="schedule.moduleData" color="info"  :instructions="instructionsInsert" id="instructionSelect" >
          <template v-slot:form>
            <div class="row justify-content-center">
              
                <template v-for="mod in schedule.moduleData">
                  <div class="col-6 col-sm-2  col-lg-1 m-1">
                    
                    <input type="radio" :value="mod.module_name" class = 'btn-check' :id="mod.id" v-model="selectedModule">
                    <label class= 'btn btn-outline-dark w-100 px-1 text-break' :for="mod.id">{{ mod.module_code }}
                    </label>
                  </div>
                </template>
              
            </div>
        </template>

      </InstructionAlert>
      <ScheduleBlock :modules="schedule.moduleData" :time-slots="timeSlots" :week-days="weekDays" :current-schedule="schedule.currentSchedule" :selected-module="selectedModule" mode="edit" @insertModule="changesMade=true"></ScheduleBlock>

    </template>

    <template v-else-if="!editSchedule && hasSchedule ">
      <ScheduleBlock :modules="schedule.moduleData" :time-slots="timeSlots" :week-days="weekDays" :current-schedule="schedule.currentSchedule" mode="view"></ScheduleBlock>
      
    </template>
    
    
    </div>
    <div class="module-pill btn rounded-pill btn-outline-info text-end" type="button" data-bs-toggle="collapse" data-bs-target="#mod-data" aria-expanded="false">
	  <i class="bi bi-info-circle-fill p-1"></i>

    <span>Module Reference</span>
    </div>
    <div class="module-pill module-table" id="mod-data">
      <table class="table table-border">
        <template v-for="mod in schedule.moduleData" :key="mod.id">
          <tr class="border-bottom">
            <td class="fw-bold">{{mod.module_code}}</td>
            <td class="text-end">{{ mod.module_name }}</td>
          </tr>
        </template>
      </table>
    </div>
   
  </section>
</template>

<style scoped>
.module-pill{
  position: fixed;
  right:2em;
  bottom: 1rem;
  width: fit-content;
  height: max-content;
  padding: 1rem;
}
.module-table{
  bottom:4rem;

}
#mod-data{
  background-color: rgba(255, 255, 255,0.5);
  border-radius: 1rem;
}
</style>