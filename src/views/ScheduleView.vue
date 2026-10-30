<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useScheduleStore } from '@/stores/schedule'
import { useUniversitiesStore } from '@/stores/universities'
import { useCourseCartStore } from '@/stores/courseCart'
import { useShortlistStore } from '@/stores/shortlist'
import { useAuthStore } from '@/stores/auth'
import ScheduleBlock from '@/components/ScheduleBlock.vue';
import InstructionAlert from '@/components/InstructionAlert.vue';
import BudgetNotice from '@/components/BudgetNotice.vue'

const route = useRoute()
const router = useRouter()
const schedule = useScheduleStore()
const uni = useUniversitiesStore()
const cart = useCourseCartStore()
const shortlist = useShortlistStore()
const auth = useAuthStore()

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
    .filter((university) => auth.adminActive || uni.items.some((item) =>
      item.id === university.id && item.published !== false
    ))
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
    await schedule.save(universityId.value,mode,periodId.value);
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
  schedule.addModules(cart.forUniversity(universityId.value).map((item) => ({
    id: item.universityModuleId,
    cart_module_id: item.cartModuleId,
    module_name: item.moduleName,
    module_code: item.moduleCode || item.moduleName,
  })))
}
async function discardChange(){
  await schedule.load(universityId.value,false,periodId.value) // reset the currentSchedule record
  discarding.value=!discarding.value; // show discarding text
  changesMade.value=false;
  discarding.value=!discarding.value; // revert to original button form

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
    <BudgetNotice
      :data-testid="saved ? 'schedule-saved' : schedule.error ? 'schedule-error' : undefined"
      :error-message="schedule.error || ''"
      :success-message="saved ? 'Schedule saved.' : ''"
      @dismiss-error="schedule.error = null"
      @dismiss-success="saved = false"
    />
    <div class="schedule-header mb-3" :class="{ 'schedule-header-sticky': changesMade }">
      <h1 class="page-title h3 fw-bold text-center mb-0">Weekly Schedule: {{ universityOptions.find((university) => university.id === universityId)?.name || "" }}</h1>
      <div v-if="changesMade" class="d-flex justify-content-end flex-wrap gap-2 mt-3">
        <button class="btn btn-outline-danger" :disabled="discarding" data-testid="schedule-discard-btn" @click="discardChange()">
          {{ discarding ? 'Discarding...' : 'Discard Changes' }}
        </button>
        <button class="btn btn-primary" :disabled="saving" data-testid="schedule-save-btn" @click="save()">
          {{ saving ? 'Saving...' : 'Save Schedule' }}
        </button>
      </div>
    </div>
    <div v-if="schedule.loading" class="text-muted py-3" role="status" data-testid="schedule-loading">Loading schedule...</div>

    <div class="filter-panel mb-4">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label for="schedule-university" class="form-label fw-semibold">Partner University</label>
            <select id="schedule-university" class="form-select" :value="universityId ?? ''" data-testid="schedule-university-select" @change="selectUniversity($event)">
              <option value="" disabled>Choose a University</option>
              <option v-for="u in universityOptions" :key="u.id" :value="u.id">{{ u.name }}</option>
            </select>
          </div>
          <div v-if="universityId && universityOptions.some((university) => university.id === universityId)" class="col-12 col-md-6">
            <label for="schedule-period" class="form-label fw-semibold">Exchange Period</label>
            <select id="schedule-period" class="form-select" :value="periodId ?? ''" data-testid="schedule-period-select" @change="selectPeriod($event)">
              <option v-for="p in uni.exchangePeriods" :key="p.id" :value="p.id">
                {{ p.period_name }} ({{ formatDate(p.start_date) }} – {{ formatDate(p.end_date) }}){{ schedule.savedPeriodIds.includes(p.id) ? ' · saved' : '' }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="universityId && universityOptions.some((university) => university.id === universityId)">
          <p v-if="schedule.moduleData.length" class="mt-3 mb-0" data-testid="schedule-module-count">
            {{ schedule.moduleData.length }} module{{ schedule.moduleData.length === 1 ? '' : 's' }} available from your cart and saved schedule.
          </p>
        </div>
        <p v-else-if="!universityOptions.length" class="text-muted mt-3 mb-0" data-testid="schedule-no-universities">
          <RouterLink to="/universities">Shortlist a Partner University</RouterLink> or <RouterLink to="/courses">Add Courses to Your Cart</RouterLink> to start planning.
        </p>
        <p v-else class="text-muted mt-3 mb-0" data-testid="schedule-choose-university">
          Choose a university to plan its schedule.
        </p>
    </div>

    <p v-if="universityId && !universityOptions.some((university) => university.id === universityId)" class="text-muted" data-testid="schedule-university-unavailable">
      This university is hidden from students and is unavailable for scheduling.
    </p>
    <template v-if="universityId && universityOptions.some((university) => university.id === universityId)">
    <div class="container-fluid">
  

    <template v-if="hasSchedule">
      <div class="row justify-content-center">

        <div class="btn-group w-100 my-3 schedule-mode-toggle" role="group" aria-label="Schedule mode">
          <input type="radio" class="btn-check" id="view" autocomplete="off" :checked="!editSchedule" @click="editSchedule=!editSchedule">
          <label class="btn btn-outline-primary" for="view">View Schedule</label>
          
          <input type="radio" class="btn-check" id="edit" autocomplete="off" :checked="editSchedule" @click="editSchedule=!editSchedule">
          <label class="btn btn-outline-primary" for="edit">Edit Schedule</label>
        
        </div>
      </div>
      
     </template>
    <template v-else-if="!hasSchedule && !showGrid">
        <div class="alert alert-info d-flex flex-column flex-md-row justify-content-between align-items-center gap-3" role="alert">
          <div class="text-center p-1">
            You have no schedules planned for this university.
          </div>
          <button type="button" class="btn btn-outline-primary flex-shrink-0" id="create-schedule-btn" @click="openScheduleBlock()">
            {{editSchedule?'Loading..':'New Schedule'}}
          </button>
          
        </div>
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
              <!-- modules from the cart appear here, so the empty message and the link to add more sit here too -->
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
      <ScheduleBlock :modules="schedule.moduleData" :time-slots="timeSlots" :week-days="weekDays" :selected-module="selectedModule" mode="edit" @insertModule="changesMade=true"></ScheduleBlock>

    </template>
    <template v-if="editSchedule && hasSchedule">
      <InstructionAlert action="Delete"  color="danger"  :instructions="instructionsDelete" id="instructionDelete">
        <template v-slot:form>
          <div class="row justify-content-center mb-1">
              <template v-for="mod in schedule.moduleData" :key="mod.id">
                <div class="m-2 m-md-0 col-12 col-md-2 text-center align-items-center">
                  <input type="checkbox" :value="mod.module_name" class="form-check-input" :id="`${mod.id}-2`" v-model="deleteModules" :disabled="!checkScheduleModule(mod.module_name)">
                  
                  <label class= 'px-1 form-check-label' :for="`${mod.id}-2`"  >{{ mod.module_code }}</label>
                </div>
              </template>
            
          </div>
          <div class="row justify-content-center mt-3">
            <div class="col-6 col-md-4">
              <button class="btn btn-outline-danger w-100" type="button" :disabled="deleteStatus || !deleteModules.length" @click="removeModules()"> {{ !deleteStatus?"Delete from Schedule":"Deleting…"  }}</button>
            </div>
          </div>

        </template>
      </InstructionAlert>
      <InstructionAlert action="Insert/Update" :modules="schedule.moduleData" color="info"  :instructions="instructionsInsert" id="instructionSelect" >
          <template v-slot:form>
            <div class="row justify-content-center">
              
                <template v-for="mod in schedule.moduleData" :key="mod.id">
                  <div class="col-6 col-sm-2  col-lg-1 m-1">
                    
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
      <ScheduleBlock :modules="schedule.moduleData" :time-slots="timeSlots" :week-days="weekDays" :current-schedule="schedule.currentSchedule" :selected-module="selectedModule" mode="edit" @insertModule="changesMade=true"></ScheduleBlock>
    </template>

    <template v-else-if="!editSchedule && hasSchedule ">
      <ScheduleBlock :modules="schedule.moduleData" :time-slots="timeSlots" :week-days="weekDays" :current-schedule="schedule.currentSchedule" mode="view"></ScheduleBlock>
    </template>

    </div>
    <button class="module-pill btn btn-outline-primary rounded-pill" type="button" data-bs-toggle="collapse" data-bs-target="#mod-data" aria-expanded="false" aria-controls="mod-data">
      <i class="bi bi-info-circle-fill p-1" aria-hidden="true"></i>
      <span>Module Reference</span>
    </button>
    <!-- `collapse` lets Bootstrap animate both opening and closing -->
    <div class="module-pill module-table collapse" id="mod-data">
      <div class="p-3">
      <table class="table table-border mb-0">
        <caption class="visually-hidden">Modules included in this schedule</caption>
        <template v-for="mod in schedule.moduleData" :key="mod.id">
          <tr class="border-bottom">
            <td class="fw-bold module-code">{{mod.module_code}}</td>
            <td class="module-name">{{ mod.module_name }}</td>
          </tr>
        </template>
      </table>
      </div>
    </div>
    </template>

  </section>
</template>

<style scoped>
.schedule-header-sticky {
  position: sticky;
  top: 0;
  z-index: 1030;
  padding: 1rem;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 0.25rem 0.75rem rgba(11, 35, 72, 0.12);
}

.schedule-filters {
  background: #f8f9fc;
  border: 1px solid #e8eaf0;
}

.schedule-mode-toggle {
  max-width: 32rem;
}

.module-pill{
  position: fixed;
  right:2em;
  bottom: 1rem;
  width: fit-content;
  padding: 1rem;
}
/* no fixed height on the panel: Bootstrap's collapse animates its height when opening and closing */
.module-table{
  bottom:4rem;
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
