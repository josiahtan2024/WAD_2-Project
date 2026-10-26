<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useScheduleStore } from '@/stores/schedule'
import { useUniversitiesStore } from '@/stores/universities'
import { useCourseCartStore } from '@/stores/courseCart'
import { useShortlistStore } from '@/stores/shortlist'
import ScheduleBlock from '@/components/ScheduleBlock.vue';
import InstructionAlert from '@/components/InstructionAlert.vue';

const route = useRoute()
const router = useRouter()
const schedule = useScheduleStore()
const uni = useUniversitiesStore()
const cart = useCourseCartStore()
const shortlist = useShortlistStore()
const selectedPeriodId = ref(null)

// The university being planned comes from the URL (/schedule/2); null on /schedule
const universityId = computed(() => route.params.universityId ? Number(route.params.universityId) : null)

// Dropdown options: shortlisted universities plus any university the student has carted courses for
const universityOptions = computed(() => {
  const ids = new Set([
    ...shortlist.items.map((s) => s.university_id),
    ...cart.items.map((i) => i.universityId),
  ])
  if (universityId.value) ids.add(universityId.value)
  return [...ids]
    .map((id) => ({ id, name: uni.items.find((u) => u.id === id)?.name ?? `University ${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
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
  // update when a timetable row already exists (even if all its modules were removed), else create one
  const mode = schedule.studentTimeTableId?'update':'insert';
  try {
    await schedule.save(universityId.value,mode,selectedPeriodId.value);
    saved.value = !schedule.error
    if(!schedule.error){
      changesMade.value = false; // hide the bar
      hasSchedule.value = Object.keys(schedule.currentSchedule).length > 0;
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
// Courses added to the cart on the Courses page become the modules this schedule can use
function addCartModules(){
  const codeFor = (id) => uni.mappings.find((m) => m.university_module.id === id)?.university_module.module_code
  schedule.addModules(cart.forUniversity(universityId.value).map((item) => ({
    id: item.universityModuleId,
    module_name: item.moduleName,
    // items added before moduleCode existed fall back to the mapping data, then the name
    module_code: item.moduleCode || codeFor(item.universityModuleId) || item.moduleName,
  })))
}
async function discardChange(){
  await schedule.load(universityId.value,false) // reset the currentSchedule record
  discarding.value=!discarding.value; // show discarding text
  changesMade.value=false;
  selectedPeriodId.value = schedule.exchangePeriodId ?? uni.exchangePeriods[0]?.id ?? null;
  discarding.value=!discarding.value; // revert to original button form

}

function formatDate(date){
  return new Date(date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Picking a university changes the URL; the route guards below ask before dropping unsaved changes
async function selectUniversity(event){
  const failure = await router.push({ name: 'schedule', params: { universityId: event.target.value } })
  if (failure) event.target.value = universityId.value ?? '' // switch cancelled: show the current university again
}

function confirmDiscard(){
  if (!changesMade.value) return true
  return window.confirm('You have unsaved changes to this schedule. Discard them?')
}
onBeforeRouteUpdate(confirmDiscard) // switching university from the dropdown
onBeforeRouteLeave(confirmDiscard) // leaving the schedule page

// Load everything for one university: its cart modules, saved schedule and exchange periods
async function loadUniversity(id){
  // start each university from a clean view
  editSchedule.value = false;
  showGrid.value = false;
  hasSchedule.value = false;
  changesMade.value = false;
  saved.value = false;
  selectedModule.value = '';
  deleteModules.value = [];
  schedule.error = null;
  uni.scheduleUniName = null;
  if (!id) return
  try {
    await uni.loadMappings(id)

    await uni.getUniversityName(id)
    await uni.loadExchangePeriods(id)
    await schedule.load(id,true)
    addCartModules()
    hasSchedule.value = Object.keys(schedule.currentSchedule).length > 0;
    // a saved timetable keeps its period; a new one defaults to the earliest period
    selectedPeriodId.value = schedule.exchangePeriodId ?? uni.exchangePeriods[0]?.id ?? null;

  } catch (e) {
    schedule.error = e.message
    console.log(schedule.error)
  }
}

watch(universityId, (id) => loadUniversity(id))

onMounted(async () => {
  timeSlots.value = loadTimeSlots()
  try {
    // names for the dropdown come from the universities list; options from the shortlist and cart
    await Promise.all([
      uni.items.length ? Promise.resolve() : uni.load(),
      shortlist.load(),
    ])
  } catch (e) {
    schedule.error = e.message
  }
  await loadUniversity(universityId.value)
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

    <div class="card my-3">
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-6">
            <label for="schedule-university" class="form-label fw-semibold mb-1">University</label>
            <select id="schedule-university" class="form-select" :value="universityId ?? ''" data-testid="schedule-university-select" @change="selectUniversity($event)">
              <option value="" disabled>Choose a university</option>
              <option v-for="u in universityOptions" :key="u.id" :value="u.id">{{ u.name }}</option>
            </select>
          </div>
          <div v-if="universityId" class="col-12 col-md-6">
            <label for="schedule-period" class="form-label fw-semibold mb-1">Exchange period</label>
            <select id="schedule-period" v-model="selectedPeriodId" class="form-select" data-testid="schedule-period-select" @change="changesMade=true">
              <option v-for="p in uni.exchangePeriods" :key="p.id" :value="p.id">
                {{ p.period_name }} ({{ formatDate(p.start_date) }} – {{ formatDate(p.end_date) }})
              </option>
            </select>
          </div>
        </div>

        <div v-if="universityId" class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
          <p v-if="!schedule.moduleData.length" class="text-muted m-0" data-testid="schedule-no-modules">
            No modules in your cart for this university yet. Add some to start planning.
          </p>
          <p v-else class="m-0" data-testid="schedule-module-count">
            {{ schedule.moduleData.length }} module{{ schedule.moduleData.length === 1 ? '' : 's' }} available from your cart and saved schedule.
          </p>
          <RouterLink :to="{ name: 'courses', query: { university: universityId } }" data-testid="schedule-add-courses-link">
            Add courses from Course search
          </RouterLink>
        </div>
        <p v-else-if="!universityOptions.length" class="text-muted mt-3 mb-0" data-testid="schedule-no-universities">
          <RouterLink to="/universities">Shortlist a university</RouterLink> or <RouterLink to="/courses">add courses to your cart</RouterLink> to start planning.
        </p>
        <p v-else class="text-muted mt-3 mb-0" data-testid="schedule-choose-university">
          Choose a university to plan its schedule.
        </p>
      </div>
    </div>

    <template v-if="universityId">
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
    </template>

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