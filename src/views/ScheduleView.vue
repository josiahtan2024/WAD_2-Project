<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useScheduleStore } from '@/stores/schedule'
import { useUniversitiesStore } from '@/stores/universities'
import ScheduleBlock from '@/components/ScheduleBlock.vue';
import InstructionAlert from '@/components/InstructionAlert.vue';

const route = useRoute()
const schedule = useScheduleStore()
const uni = useUniversitiesStore()
const saving = ref(false)
const saved = ref(false)
const modules = ref([]);
const m = ['BPAS','ALGOS','WAD2','DM','BGS'] 
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const timeLimit = [28800,64800] // 8am to 6pm in seconds
const timeSlots = ref ([]);
const deleteModules = ref([]);
const deleteStatus = ref(false);
const selectedModule = ref('');
const hasSchedule = ref(true);
const editSchedule = ref(false);
const showGrid = ref(false)
const instructionsInsert = ['Select a Module','Select the Start Time and End Time on the Grid',"Click 'Save' and repeat for next module"];
const instructionsDelete = ['Select your Module(s)',"Click 'Delete from Schedule'","If updating module timings: Repeat Steps 1 and 2 under Insert/Update Modules"];
const currentSchedule = ref({"Monday":[{"module":"BPAS","start":34200,"end":43200}],
"Wednesday":[{"module":"BGS","start":34200,"end":43200}],
"Friday":[{"module":"WAD2","start":41400,"end":45000}],
"Tuesday":[{"module":"ALGOS","start":46800,"end":50400}],
"Thursday":[{"module":"DM","start":46800,"end":54000}]});

const universityName = ref('Default Uni')


async function save() {
  saving.value = true
  saved.value = false
  schedule.error = null
  try {
    await schedule.save(route.params.universityId)
    saved.value = true
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

  for (const day in currentSchedule.value) {  
    currentSchedule.value[day] = currentSchedule.value[day].filter((mod) => !deleteModules.value.includes(mod.module) )

  }
  deleteStatus.value = !deleteStatus.value; //change button status text to 'deleting'

  setTimeout(() =>{
    deleteStatus.value = !deleteStatus.value; // revert button status to normal
  },1000)
  deleteModules.value=[];
  
}

function checkScheduleModule(mod){
  
  for (const day in currentSchedule.value) {
    let record = currentSchedule.value[day].find(lesson => lesson.module === mod)
    if (record) {
      return record;
    }
  }
  return false;
}

onMounted(async () => {
  try {
    await uni.loadMappings(route.params.universityId)
    await schedule.load(route.params.universityId)
    timeSlots.value = loadTimeSlots()
    m.forEach(ml => modules.value.push(ml))

  } catch (e) {
    schedule.error = e.message
  }
})
</script>

<template>
  <section data-testid="schedule-page">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h3 mb-0">Weekly schedule</h1>
      <button class="btn btn-primary" :disabled="saving" data-testid="schedule-save-btn" @click="save">
        {{ saving ? 'Saving...' : 'Save schedule' }}
      </button>
    </div>
    <div v-if="schedule.error" class="alert alert-danger" data-testid="schedule-error">{{ schedule.error }}</div>
    <div v-if="saved" class="alert alert-success" data-testid="schedule-saved">Schedule saved.</div>
    <div v-if="schedule.loading" class="text-muted" data-testid="schedule-loading">Loading schedule...</div>

    <div class="row g-3">
      <div class="col-12 col-lg-3">
        <h2 class="h6">Mapped modules</h2>
        <p v-if="!uni.mappings.length" class="text-muted" data-testid="schedule-no-modules">No mapped modules for this university.</p>
        <!-- TODO(student): render one draggable ScheduleBlock per mapped module -->
        <ScheduleBlock />
      </div>
      
    </div>


      <div class="container-fluid">
  
    <div class="row"><h1 class="text-center">My Schedule - {{ universityName }}</h1></div>

    <template v-if="hasSchedule">
      <div class="row justify-content-center">

        <div class="btn-group w-50 my-3" role="group" aria-label="Basic radio toggle button group">
          <input type="radio" class="btn-check" id="view" autocomplete="off" :checked="!editSchedule" @click="editSchedule=!editSchedule">
          <label class="btn btn-outline-info w-20" for="view">View Schedule</label>
          
          
          <input type="radio" class="btn-check" id="edit" autocomplete="off" :checked="editSchedule" @click="editSchedule=!editSchedule">
          <label class="btn btn-outline-dark w-20 " for="edit">Edit Schedule</label>
          
          
        </div>
      </div>
      
     </template>
    <template v-else-if="!hasSchedule && !showGrid">
        <div class="alert alert-info row justify-content-between align-items-center w-75 mx-auto" role="alert">
          <div class="col-md-8 text-center p-1">
            You have no schedules planned for university.
          </div>
          <div class="btn btn-outline-info col-md-3" id="create-schedule-btn" @click="openScheduleBlock()">
            
            {{editSchedule?'Loading..':'New Schedule'}}
          </div>
          
        </div>
    </template>

    <template v-if="showGrid">

      <InstructionAlert action="Insert" :modules="m" color="info"  :instructions="instructionsInsert" @select-mod="onSelectMod()" id="instructionSelect">
        <template v-slot:form>
          <div class="row justify-content-center">
            
              <template v-for="mod in m" :key="mod">
                <div class="col-6 col-sm-2 col-lg-1  m-1">
                  
                  <input type="radio" :value="mod" class = 'btn-check' :id="`${mod}-2`" v-model="selectedModule">
                  <label class= 'btn btn-outline-dark w-100 px-1' :for="`${mod}-2`" >{{ mod }}
                  </label>
                </div>
              </template>
            
          </div>
        </template>

      </InstructionAlert>
      <ScheduleBlock :modules="m" :time-slots="timeSlots" :week-days="weekDays" :selected-module="selectedModule" mode="edit"></ScheduleBlock>

    </template>
    <template v-if="editSchedule && hasSchedule">
      <InstructionAlert action="Delete" :modules="m" color="danger"  :instructions="instructionsDelete" id="instructionDelete">
        <template v-slot:form>
          <div class="row justify-content-center mb-1">
            

              <template v-for="mod in m" :key="mod">
                <div class="m-2 m-md-0 col-sm-2 text-center">
                  <input type="checkbox" :value="mod" class="form-check-input" :id="`${mod}-1`" v-model="deleteModules" :disabled="!checkScheduleModule(mod)">
                  <label class= 'px-1 form-check-label' :for="`${mod}-1`"  >{{ mod }}</label>
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
      <InstructionAlert action="Insert/Update" :modules="m" color="info"  :instructions="instructionsInsert" id="instructionSelect" >
          <template v-slot:form>
            <div class="row justify-content-center">
              
                <template v-for="mod in m" :key="mod">
                  <div class="col-6 col-sm-2 col-lg-1  m-1">
                    
                    <input type="radio" :value="mod" class = 'btn-check' :id="`${mod}-2`" v-model="selectedModule">
                    <label class= 'btn btn-outline-dark w-100 px-1' :for="`${mod}-2`">{{ mod }}
                    </label>
                  </div>
                </template>
              
            </div>
        </template>

      </InstructionAlert>
      <ScheduleBlock :modules="m" :time-slots="timeSlots" :week-days="weekDays" :current-schedule="currentSchedule" :selected-module="selectedModule" mode="edit"></ScheduleBlock>

    </template>

    <template v-else-if="!editSchedule && hasSchedule ">
      <ScheduleBlock :modules="m" :time-slots="timeSlots" :week-days="weekDays" :current-schedule="currentSchedule" mode="view"></ScheduleBlock>
      
    </template>
    
    
  </div>

  </section>
</template>
