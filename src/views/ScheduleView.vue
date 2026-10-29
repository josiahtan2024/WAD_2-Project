<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useScheduleStore } from '@/stores/schedule'
import { useUniversitiesStore } from '@/stores/universities'
import { useCourseCartStore } from '@/stores/courseCart'
import { useShortlistStore } from '@/stores/shortlist'
import ScheduleBlock from '@/components/ScheduleBlock.vue';
import InstructionAlert from '@/components/InstructionAlert.vue';
import ModuleTable from '@/components/ModuleTable.vue'

const route = useRoute()
const router = useRouter()
const schedule = useScheduleStore()
const uni = useUniversitiesStore()
const cart = useCourseCartStore()
const shortlist = useShortlistStore()

// The timetable being planned comes from the URL: /schedule/2?period=4 is university 2, exchange period 4.
// Each university + period pair is its own timetable. Both are null on plain /schedule.
const universityId = computed(() => route.params.universityId ? Number(route.params.universityId) : null)
const periodId = computed(() => route.query.period ? Number(route.query.period) : null)
let loadedUniversityId = null // whose name, mappings and periods are loaded

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
const showFloatingTable = ref(false);
const changesMade = ref(false)
const instructionsInsert = ['Select a Module','Select the Start Time and End Time on the Grid',"Click 'Add' and repeat for next module"];
const instructionsDelete = ['Select your Module(s)',"Click 'Delete from Schedule'","If updating module timings: Perform steps under 'To Insert/Update Modules' after deletions"];
async function save() {
  saving.value = true
  saved.value = false
  schedule.error = null
  // update when a timetable row already exists (even if all its modules were removed), else create one
  const mode = schedule.studentTimeTableId?'update':'insert';
  try {
    await schedule.save(universityId.value,mode,periodId.value);
    saved.value = !schedule.error
    if(!schedule.error){
      changesMade.value = false; // hide the bar
      hasSchedule.value = Object.keys(schedule.currentSchedule).length > 0;
      await loadTimetable(); //reload the whole view to display updated timetable
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
  schedule.addModules(cart.forUniversity(universityId.value).map((item) => ({
    id: item.universityModuleId,
    cart_module_id: item.cartModuleId,
    module_name: item.moduleName,
    module_code: item.moduleCode || item.moduleName,
  })))
}
async function discardChange(){
  await schedule.load(universityId.value,false,periodId.value) // reset the currentSchedule record
  discarding.value=true; // show discarding text
  
  setTimeout(()=>{
    changesMade.value=false;
    discarding.value=false; // revert to original button form
  },700);
  

}

function formatDate(date){
  return new Date(date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Picking a university or period changes the URL; the route guards below ask before dropping unsaved changes
async function selectUniversity(event){
  // no period in the URL: loadTimetable() opens a default period for the new university
  const failure = await router.push({ name: 'schedule', params: { universityId: event.target.value } })
  if (failure) event.target.value = universityId.value ?? '' // switch cancelled: show the current university again
}
async function selectPeriod(event){
  const failure = await router.push({ name: 'schedule', params: { universityId: universityId.value }, query: { period: event.target.value } })
  if (failure) event.target.value = periodId.value ?? '' // switch cancelled: show the current period again
}

function confirmDiscard(){
  if (!changesMade.value) return true
  return window.confirm('You have unsaved changes to this schedule. Discard them?')
}
onBeforeRouteUpdate(confirmDiscard) // switching university or period from the dropdowns
onBeforeRouteLeave(confirmDiscard) // leaving the schedule page

function resetView(){
  editSchedule.value = false;
  showGrid.value = false;
  hasSchedule.value = false;
  changesMade.value = false;
  saved.value = false;
  selectedModule.value = '';
  deleteModules.value = [];
  schedule.error = null;
}

// Load the timetable for the university + period in the URL, with that university's cart modules
async function loadTimetable(){
  const id = universityId.value
  resetView()
  if (!id) {
    loadedUniversityId = null
    uni.scheduleUniName = null
    return
  }
  try {
    if (loadedUniversityId !== id) {
      uni.scheduleUniName = null
      await uni.loadMappings(id)

      await uni.getUniversityName(id)
      await uni.loadExchangePeriods(id)
      await schedule.loadSavedPeriods(id)
      loadedUniversityId = id
    }
    if (!uni.exchangePeriods.some((p) => p.id === periodId.value)) {
      // no (valid) period chosen: open the earliest period with a saved timetable, else the earliest period
      const first = uni.exchangePeriods.find((p) => schedule.savedPeriodIds.includes(p.id)) ?? uni.exchangePeriods[0]
      if (first) await router.replace({ name: 'schedule', params: { universityId: id }, query: { period: first.id } })
      return // the URL change runs loadTimetable() again with that period
    }
    await schedule.load(id,true,periodId.value)
    await cart.ensureLoaded() // the cart comes from Supabase, so wait for it before reading it
    addCartModules()
    hasSchedule.value = Object.keys(schedule.currentSchedule).length > 0;

  } catch (e) {
    schedule.error = e.message
    console.log(schedule.error)
  }
}

watch([universityId, periodId], loadTimetable)

onMounted(async () => {
  timeSlots.value = loadTimeSlots()
  try {

    // names for the dropdown come from the universities list; options from the shortlist and cart
    await Promise.all([
      uni.items.length ? Promise.resolve() : uni.load(),
      shortlist.load(),
      cart.ensureLoaded(),
    ])

  } catch (e) {
    schedule.error = e.message
  }
  await loadTimetable()
})

</script>

<template>
  <section data-testid="schedule-page">
    <div class="card top-0 z-3" :class="{'position-sticky':changesMade}">
 <div class="card-body">
        <div class="d-flex flex-column align-items-end-lg align-items-center-xs" :class="{'justify-content-center':!changesMade,'justify-content-between':changesMade}">
          <h1 class="h3 fw-bold text-center mb-3">Weekly Schedule</h1><h1 :class="{'d-block':changesMade}" class="text-primary h3 fw-bold text-center mb-3">{{ uni.scheduleUniName?`${uni.scheduleUniName}`:"" }}</h1>
          <template v-if="changesMade">
          <div class="changes-pill btn-group w-lg-50 mx-auto" role="group">
            <button class="btn btn-danger" :disabled="discarding" data-testid="schedule-save-btn" @click="discardChange()">
              {{ discarding ? 'Discarding..' : 'Discard Changes' }}
            </button>
            <button class="btn btn-primary" :disabled="saving" data-testid="schedule-save-btn" @click="save()">
              {{ saving ? 'Saving...' : 'Save Schedule' }}
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
            <select id="schedule-period" class="form-select" :value="periodId ?? ''" data-testid="schedule-period-select" @change="selectPeriod($event)">
              <option v-for="p in uni.exchangePeriods" :key="p.id" :value="p.id">
                {{ p.period_name }} ({{ formatDate(p.start_date) }} – {{ formatDate(p.end_date) }}){{ schedule.savedPeriodIds.includes(p.id) ? ' · saved' : '' }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="universityId">
          <p v-if="schedule.moduleData.length" class="mt-3 mb-0" data-testid="schedule-module-count">
            {{ schedule.moduleData.length }} module{{ schedule.moduleData.length === 1 ? '' : 's' }} available from your cart and saved schedule.
          </p>
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
      <div class="row">
        <template v-if="hasSchedule">
          <div class="row justify-content-center">

            <div class="btn-group w-50 my-3" role="group" aria-label="Basic radio toggle button group">
              <input type="radio" class="btn-check" id="view" autocomplete="off" :checked="!editSchedule" @click="editSchedule=!editSchedule">
              <label class="btn btn-outline-info w-20" for="view">View Schedule</label>
              
              <input type="radio" class="btn-check" id="edit" autocomplete="off" :checked="editSchedule" @click="editSchedule=!editSchedule">
              <label class="btn btn-outline-dark w-20   " for="edit">Edit Schedule</label>
            
            </div>
          </div>
          
        </template>
        <template v-else-if="!hasSchedule && !showGrid">
            <div class="alert row justify-content-between align-items-center w-75 mx-auto" role="alert">
              <div class="col-md-8 text-center p-1">
                You have no schedules planned for this university. Click on <span class="text-primary fw-bold">'New Schedule'</span> to start.
              </div>
              <div class="btn btn-outline-primary col-md-3" id="create-schedule-btn" @click="openScheduleBlock()">
                
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
          <div class="col-md-6">
            <InstructionAlert action="Insert" :instructions="instructionsInsert" @select-mod="onSelectMod()" id="instructionSelect" :modules="schedule.moduleData">
              <template v-slot:form>
                <div class="row justify-content-center">
                  
                    <template v-for="mod in schedule.moduleData" :key="mod.id">
                      <div class="col-4 my-1">
                        
                        <input type="radio" :value="mod.module_name" class = 'btn-check' :id="`${mod.id}-1`" v-model="selectedModule">
                        <label class= 'btn btn-outline-dark w-100 px-1' :for="`${mod.id}-1`" >{{ mod.module_code }}
                        </label>
                      </div>
                    </template>
                    <!-- modules from the cart appear here, so the empty message and the link to add more sit here too -->
                    <p v-if="!schedule.moduleData.length" class="text-muted text-center m-0 card-footer" data-testid="schedule-no-modules">
                      No modules in your cart for this university yet. Add some to start planning.
                    </p>
                    <div class="col-12 text-center mt-2">
                      <RouterLink :to="{ name: 'courses', query: { university: universityId } }" data-testid="schedule-add-courses-link">
                        Add courses from Course search
                      </RouterLink>
                    </div>
                </div>
              </template>

            </InstructionAlert>
          </div>
          <div class="col-md-6">
            <ScheduleBlock :modules="schedule.moduleData" :time-slots="timeSlots" :week-days="weekDays" :selected-module="selectedModule" mode="edit" @insertModule="changesMade=true"></ScheduleBlock>
          </div>

        </template>
        <template v-else-if="editSchedule && hasSchedule">
          <div class="col-md-6">
            <ModuleTable></ModuleTable>
            <InstructionAlert action="Delete" :instructions="instructionsDelete" id="instructionDelete">
              <template v-slot:form>
                <div class="d-flex mx-auto">
                    <template v-for="mod in schedule.moduleData" :key="mod.id">
                      <div class="text-center align-items-center p-1">
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
            <InstructionAlert action="Insert/Update" :modules="schedule.moduleData"  :instructions="instructionsInsert" id="instructionSelect" >
                <template v-slot:form>
                  <div class="row justify-content-center">
                    
                      <template v-for="mod in schedule.moduleData" :key="mod.id">
                        <div class="col-4 my-1">
                          
                          <input type="radio" :value="mod.module_name" class = 'btn-check' :id="mod.id" v-model="selectedModule">
                          <label class= 'btn btn-outline-dark w-100 px-1 text-break' :for="mod.id">{{ mod.module_code }}
                          </label>
                        </div>
                      </template>
                      <p v-if="!schedule.moduleData.length" class="text-muted text-center m-0" data-testid="schedule-no-modules">
                        No modules in your cart for this university yet. Add some to start planning.
                      </p>
                      <div class="col-12 text-center mt-2">
                        <RouterLink :to="{ name: 'courses', query: { university: universityId } }" data-testid="schedule-add-courses-link">
                          Add courses from Course search
                        </RouterLink>
                      </div>
                  </div>
              </template>
            </InstructionAlert>
          </div>
          <div class="col-md-6 p-0">
            <ScheduleBlock :modules="schedule.moduleData" :time-slots="timeSlots" :week-days="weekDays" :current-schedule="schedule.currentSchedule" :selected-module="selectedModule" mode="edit" @insertModule="changesMade=true"></ScheduleBlock>
          </div>
        </template>

        <template v-else-if="!editSchedule && hasSchedule ">
          <div class="col-md-6">
            <ModuleTable></ModuleTable>
          </div>
          <div class="col-md-6 p-0">
            <ScheduleBlock :modules="schedule.moduleData" :time-slots="timeSlots" :week-days="weekDays" :current-schedule="schedule.currentSchedule" mode="view"></ScheduleBlock>
          </div>
        </template>
      </div>
    </div>
    <div class="module-pill btn rounded-pill btn-outline-info text-end d-block d-md-none"  @click="showFloatingTable=!showFloatingTable">
      <i class="bi bi-info-circle-fill p-1"></i>

      <span>Module Reference</span>
    </div>
    <!-- `collapse` lets Bootstrap animate both opening and closing -->
    <div class="module-table d-block d-md-none"  id="mod-data">
      <div class="p-3" :hidden="showFloatingTable">
      <table class="table table-border mb-0">
        
          <tr v-for="mod in schedule.moduleData" :key="mod.id" class="border-bottom d-flex justify-content-between">
            <td class="module-name text-secondary">{{ mod.module_name }}</td>
            <td class="fw-semibold module-code text-end">{{mod.module_code}}</td>
          </tr>
        
      </table>
      </div>
    </div>
  </template>

  </section>
</template>

<style scoped>
.module-pill{
  position: fixed;
  right:2em;
  bottom: 2rem;
  width: fit-content;
  padding: 1rem;
}
/* no fixed height on the panel: Bootstrap's collapse animates its height when opening and closing */
.module-table{
  position: fixed;
  right: 2em;
  bottom:6rem;
  padding: 0; /* padding lives on the inner wrapper so the panel can shrink fully to 0 */
  max-width: min(26rem, calc(100vw - 4em));
}
.module-table.collapsing{
  overflow: hidden;
}
/* codes in an even-width column, names left-aligned and wrapping onto a second line when long */
.module-code{
  white-space: nowrap;
  padding-right: 1.25rem;
  vertical-align: top;
}
.module-name{
  text-align: left;
  vertical-align: top;
}
#mod-data{
  background-color: rgba(255, 255, 255,0.5);
  border-radius: 1rem;
}
</style>