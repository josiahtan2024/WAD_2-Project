<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useScheduleStore } from '@/stores/schedule'
import { useUniversitiesStore } from '@/stores/universities'
import { useCourseCartStore } from '@/stores/courseCart'
import { useShortlistStore } from '@/stores/shortlist'
import { useAuthStore } from '@/stores/auth'
import ScheduleBlock from '@/components/ScheduleBlock.vue'
import ModuleTable from '@/components/ModuleTable.vue'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const schedule = useScheduleStore()
const uni = useUniversitiesStore()
const cart = useCourseCartStore()
const shortlist = useShortlistStore()
const auth = useAuthStore()

const saving = ref(false)
const discarding = ref(false)
const saved = ref(false)
const selectedModule = ref('')
const hasSchedule = ref(false)
const editSchedule = ref(false)
const changesMade = ref(false)

let loadedUniversityId = null

const universityId = computed(() => (route.params.universityId ? Number(route.params.universityId) : null))

const periodId = computed(() => {
  const parsed = Number(route.query.period)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})

const universityOptions = computed(() => {
  const ids = new Set([
    ...shortlist.items.map((s) => s.university_id),
    ...cart.items.map((i) => i.universityId),
  ])
  if (universityId.value) ids.add(universityId.value)
  return [...ids]
    .map((id) => ({ id, name: uni.items.find((u) => u.id === id)?.name ?? `University ${id}` }))
    .filter(
      (university) =>
        auth.adminActive ||
        uni.items.some((item) => item.id === university.id && item.published !== false)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
})

function handleToggleEdit() {
  editSchedule.value = !editSchedule.value
  if (!editSchedule.value) {
    selectedModule.value = ''
  }
}

function handleSelectModule(modName) {
  if (!editSchedule.value) {
    editSchedule.value = true
  }
  selectedModule.value = selectedModule.value === modName ? '' : modName
}

function addCartModules() {
  schedule.addModules(
    cart.forUniversity(universityId.value).map((item) => ({
      id: item.universityModuleId,
      cart_module_id: item.cartModuleId,
      module_name: item.moduleName,
      module_code: item.moduleCode || item.moduleName,
    }))
  )
}

function formatDate(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const discardPrompt = ref(null)

function confirmDiscard() {
  if (!changesMade.value) return true
  discardPrompt.value?.(false)
  return new Promise((resolve) => {
    discardPrompt.value = resolve
  })
}

function answerDiscard(discard) {
  discardPrompt.value?.(discard)
  discardPrompt.value = null
}

function resetView() {
  editSchedule.value = false
  hasSchedule.value = false
  changesMade.value = false
  saved.value = false
  selectedModule.value = ''
  schedule.resetStore()
}

async function selectUniversity(event) {
  const val = event.target.value
  if (!val) {
    await router.push({ name: 'schedule' })
    return
  }
  const failure = await router.push({
    name: 'schedule',
    params: { universityId: val },
  })
  if (failure) event.target.value = universityId.value ?? ''
}

async function selectPeriod(event) {
  const val = event.target.value
  if (!val) {
    await router.push({
      name: 'schedule',
      params: { universityId: universityId.value },
    })
    return
  }
  const failure = await router.push({
    name: 'schedule',
    params: { universityId: universityId.value },
    query: { period: val },
  })
  if (failure) event.target.value = periodId.value ?? ''
}

async function discardChange() {
  selectedModule.value = ''
  if (periodId.value) {
    await schedule.load(universityId.value, false, periodId.value)
  } else {
    schedule.resetStore()
  }
  discarding.value = true

  setTimeout(() => {
    changesMade.value = false
    discarding.value = false
    editSchedule.value = false
  }, 400)
}

onBeforeRouteUpdate(confirmDiscard)
onBeforeRouteLeave(confirmDiscard)

async function loadTimetable() {
  const id = universityId.value
  const currentPeriod = periodId.value
  resetView()

  if (!id) {
    loadedUniversityId = null
    schedule.savedPeriodIds = []
    uni.scheduleUniName = null
    return
  }

  try {
    if (loadedUniversityId !== id) {
      schedule.savedPeriodIds = []
      uni.scheduleUniName = null
      await uni.loadMappings(id)
      await uni.getUniversityName(id)
      await uni.loadExchangePeriods(id)
      await schedule.loadSavedPeriods(id)
      loadedUniversityId = id
    }

    if (currentPeriod && !uni.exchangePeriods.some((p) => p.id === currentPeriod)) {
      const first =
        uni.exchangePeriods.find((p) => schedule.savedPeriodIds.includes(p.id)) ??
        uni.exchangePeriods[0]
      if (first) {
        await router.replace({
          name: 'schedule',
          params: { universityId: id },
          query: { period: first.id },
        })
      }
      return
    }

    if (currentPeriod) {
      await schedule.load(id, true, currentPeriod)
    }

    await cart.ensureLoaded()
    addCartModules()
    hasSchedule.value =
      Object.keys(schedule.currentSchedule).length > 0 || schedule.studentTimeTableId !== null
  } catch (e) {
    schedule.error = e.message
  }
}

async function save() {
  if (!periodId.value) {
    schedule.error = 'Please select an Exchange Period before saving.'
    return
  }

  saving.value = true
  saved.value = false
  schedule.error = null
  const mode = schedule.studentTimeTableId ? 'update' : 'insert'
  try {
    await schedule.save(universityId.value, mode, periodId.value)
    saved.value = !schedule.error
    if (!schedule.error) {
      changesMade.value = false
      selectedModule.value = ''
      editSchedule.value = false
      hasSchedule.value = Object.keys(schedule.currentSchedule).length > 0
      await loadTimetable()
    }
  } catch (e) {
    schedule.error = e.message
  } finally {
    saving.value = false
  }
}

watch([universityId, periodId], loadTimetable)

onMounted(async () => {
  try {
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
  <section class="container py-4 mb-5" data-testid="schedule-page">
    <DeleteConfirmDialog
      :open="!!discardPrompt"
      title="Discard Changes?"
      action-label="Discard"
      working-label="Discarding..."
      close-label="Keep editing"
      @cancel="answerDiscard(false)"
      @confirm="answerDiscard(true)"
    >
      <template #description>
        You have unsaved changes to this schedule.
        <br>Discarding them cannot be undone.
      </template>
    </DeleteConfirmDialog>
    <div class="mb-4 pb-3 border-bottom">
      <h1 class="page-title h3 fw-bold text-navy mb-1">Exchange Weekly Schedule</h1>
      <p class="text-muted small mb-0">
        Plan and save your weekly class schedule for your exchange partner university.
      </p>
    </div>

    <div class="filter-panel mb-4 p-4 border rounded-4" data-testid="schedule-filters">
      <div class="row g-3 align-items-end">
        <div class="col-12 col-md-6">
          <label for="schedule-university" class="form-label fw-semibold small text-navy">Partner University</label>
          <select
            id="schedule-university"
            class="form-select shadow-none"
            :value="universityId ?? ''"
            data-testid="schedule-university-select"
            @change="selectUniversity($event)"
          >
            <option value="">Choose a University</option>
            <option v-for="u in universityOptions" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </div>

        <div
          v-if="universityId && universityOptions.some((university) => university.id === universityId)"
          class="col-12 col-md-6"
        >
          <label for="schedule-period" class="form-label fw-semibold small text-navy">Exchange Period</label>
          <select
            id="schedule-period"
            class="form-select shadow-none"
            :value="periodId ?? ''"
            data-testid="schedule-period-select"
            @change="selectPeriod($event)"
          >
          <option value="">Choose a Period</option>
          <option v-for="p in uni.exchangePeriods" :key="p.id" :value="p.id">
            {{ p.period_name }} | {{ formatDate(p.start_date) }} - {{ formatDate(p.end_date) }}
            {{ schedule.savedPeriodIds.includes(p.id) ? '(Saved)' : '' }}
          </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="schedule.loading" class="text-muted text-center py-5" data-testid="schedule-loading">
      <div class="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
      Loading timetable...
    </div>

    <!-- Workspace -->
    <template v-else-if="universityId">
      <div class="row g-4">
        <!-- Module Reference List with Controls -->
        <div class="col-12 col-lg-5">
          <ModuleTable
            :selected-module="selectedModule"
            :is-editing="editSchedule"
            :changes-made="changesMade"
            :saving="saving"
            :discarding="discarding"
            :uniId="universityId"
            @select-module="handleSelectModule"
            @toggle-edit="handleToggleEdit"
            @save="save"
            @discard="discardChange"
          />
        </div>

        <!-- Timetable Grid -->
        <div class="col-12 col-lg-7">
          <ScheduleBlock
            :modules="schedule.moduleData"
            :selected-module="selectedModule"
            :mode="editSchedule ? 'edit' : 'view'"
            :error-message="schedule.error"
            :period-selected="Boolean(periodId)"
            @insert-module="changesMade = true"
            @remove-module="changesMade = true"
            @clear-error="schedule.error = null"
          />
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy, #141b4d);
}

.filter-panel .btn-outline-secondary {
  --bs-btn-color: var(--app-gray-blue);
  --bs-btn-border-color: #d5d8e5;
  --bs-btn-hover-color: #fff;
  --bs-btn-hover-bg: var(--app-gray-blue);
  --bs-btn-hover-border-color: var(--app-gray-blue);
}
</style>