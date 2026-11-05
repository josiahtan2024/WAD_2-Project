<script setup>
import { computed, ref } from 'vue'
import { useScheduleStore } from '@/stores/schedule'

const props = defineProps({
  modules: { type: Array, default: () => [] },
  selectedModule: { type: String, default: '' },
  mode: { type: String, default: 'view' },
  errorMessage: { type: String, default: '' },
  periodSelected: { type: Boolean, default: false },
})

const emit = defineEmits(['insertModule', 'removeModule', 'clearError'])

const selectedDay = ref('')
const startTime = ref(0)
const endTime = ref(0)
const activeSlotMenu = ref(null)

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const timeLimit = [28800, 64800] // 8:00 AM to 6:00 PM in seconds

const noModuleError = ref(false)
const schedule = useScheduleStore()

const selectedModuleCode = computed(() => {
  const match = schedule.moduleData.find((m) => m.module_name === props.selectedModule)
  return match ? match.module_code : ''
})

const startSlot = computed(() => (day, time) => day === selectedDay.value && time === startTime.value)
const midSlot = computed(() => (day, time) => time > startTime.value && time < endTime.value && day === selectedDay.value)
const endSlot = computed(() => (day, time) => day === selectedDay.value && time === endTime.value && startTime.value > 0)

const timeSlots = computed(() => {
  const ts = []
  for (let t = timeLimit[0]; t <= timeLimit[1]; t += 1800) {
    ts.push(t)
  }
  return ts
})

function isEditMode() {
  return props.mode?.trim() === 'edit' && props.periodSelected
}

function timeString(timeInt) {
  const hh = String(Math.floor(Number(timeInt) / 3600)).padStart(2, '0')
  const mm = String(Math.floor((Number(timeInt) / 60) % 60)).padStart(2, '0')
  return `${hh}:${mm}`
}

function isBlocked(day, time) {
  if (day in schedule.currentSchedule) {
    for (const slot of schedule.currentSchedule[day]) {
      if (time >= slot.start && time <= slot.end) {
        return { 
          blocked: true, 
          mod: time === slot.start ? slot.module : '',
          fullModName: slot.moduleName
        }
      }
    }
  }
  return { blocked: false, mod: '', fullModName: '' }
}

function getModuleCode(modName) {
  const found = schedule.moduleData.find((m) => m.module_name === modName)
  return found ? found.module_code : modName
}

function handleSlotClick(day, time) {
  if (!isEditMode()) return

  const blockInfo = isBlocked(day, time)

  if (blockInfo.blocked) {
    activeSlotMenu.value = {
      day,
      time,
      moduleName: blockInfo.fullModName,
      moduleCode: blockInfo.mod || getModuleCode(blockInfo.fullModName)
    }
    return
  }

  activeSlotMenu.value = null

  if (props.selectedModule?.trim()) {
    if (!startTime.value) {
      startTime.value = time
      selectedDay.value = day
    } else if (startTime.value && selectedDay.value === day && time > startTime.value) {
      endTime.value = time
    }
  } else {
    noModuleError.value = true
    setTimeout(() => {
      noModuleError.value = false
    }, 2000)
  }
}

function clearSelection() {
  selectedDay.value = ''
  startTime.value = 0
  endTime.value = 0
  activeSlotMenu.value = null
}

function addSelection(day, start, end, moduleName) {
  if (!(day in schedule.currentSchedule)) {
    schedule.currentSchedule[day] = []
  }
  schedule.currentSchedule[day].push({
    moduleName,
    module: selectedModuleCode.value,
    start,
    end,
  })
  emit('insertModule')
  clearSelection()
}

function removeBlockByModuleName(modName) {
  for (const day in schedule.currentSchedule) {
    schedule.currentSchedule[day] = schedule.currentSchedule[day].filter(
      (mod) => mod.moduleName !== modName
    )
  }
  emit('removeModule')
  activeSlotMenu.value = null
}
</script>

<template>
  <div class="card border rounded-4 shadow-sm bg-white position-relative overflow-hidden schedule-block-card" data-testid="schedule-block">
    <div class="card-header bg-white p-3 border-bottom d-flex align-items-center justify-content-between flex-shrink-0 gap-2">
      <div class="d-flex align-items-center gap-3">
        <h3 class="h6 fw-bold text-navy mb-0">Timetable Grid</h3>
        <span
          class="badge rounded-pill fw-semibold px-2 py-1 fs-9 d-inline-flex align-items-center gap-2"
          :class="isEditMode() ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-surface text-secondary border'"
        >
          {{ isEditMode() ? 'Editing Mode' : 'View Mode' }}
        </span>
      </div>

      <div v-if="isEditMode() && props.selectedModule" class="d-flex align-items-center gap-2">
        <span class="text-muted fs-9 fw-medium d-none d-sm-inline">Selected:</span>
        <span class="badge bg-primary text-white fw-bold px-2 py-1 fs-9 d-inline-flex align-items-center gap-1 shadow-2xs">
          <i class="bi bi-pin-angle-fill"></i>
          {{ selectedModuleCode }}
        </span>
      </div>
    </div>

    <div class="card-body p-0 grid-container-body position-relative">
      <div class="table-responsive schedule-grid-scroll" :class="{ 'grid-disabled': !props.periodSelected }">
        <table class="table table-bordered mb-0 align-middle">
          <thead class="bg-surface">
            <tr class="text-center">
              <th class="timing-header bg-surface">&nbsp;</th>
              <th v-for="day in weekDays" :key="day" class="text-navy fw-bold small py-2 uppercase-day">
                {{ day }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="time in timeSlots" :key="time">
              <th class="timing text-muted small fw-medium" scope="row">{{ timeString(Number(time)) }}</th>
              <td
                v-for="day in weekDays"
                :key="day"
                class="slot text-center text-white fw-bold small position-relative"
                :class="{
                  blocked: isBlocked(day, time).blocked,
                  disabled: !isEditMode(),
                  'active-selection': startSlot(day, time) || endSlot(day, time) || midSlot(day, time),
                }"
                @click="handleSlotClick(day, time)"
              >
                <span class="slot-content text-truncate d-block px-1">{{ isBlocked(day, time).mod }}</span>

                <button
                  v-if="isEditMode() && isBlocked(day, time).mod"
                  class="quick-remove-btn btn btn-danger btn-sm p-0 rounded-circle shadow-2xs"
                  title="Remove Module Slot"
                  @click.stop="removeBlockByModuleName(isBlocked(day, time).fullModName)"
                >
                  <i class="bi bi-x"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Lock Screen Overlay when Exchange Period is Unselected -->
      <div v-if="!props.periodSelected" class="disabled-period-overlay position-absolute inset-0 d-flex flex-column align-items-center justify-content-center text-center p-4">
        <div class="bg-white rounded-circle p-3 shadow-sm mb-2 text-primary border border-light">
          <i class="bi bi-calendar-x fs-3"></i>
        </div>
        <h4 class="h6 fw-bold text-navy mb-1">Exchange Period Required</h4>
        <p class="text-secondary small mb-0 max-w-xs">Please select an Exchange Period above to view or construct your timetable schedule.</p>
      </div>
    </div>
    
    <!-- Warning Toast Popup -->
    <div
      v-if="noModuleError"
      class="floating-popover card border-warning-subtle shadow-lg rounded-4 p-3 bg-white z-3"
    >
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="d-flex align-items-center gap-2 text-navy small fw-semibold">
          <div class="icon-circle bg-warning-subtle text-warning flex-shrink-0">
            <i class="bi bi-exclamation-triangle-fill"></i>
          </div>
          <span>Select a module from Reference first</span>
        </div>
        <button class="btn btn-sm btn-link text-secondary p-0 ms-2" @click="noModuleError = false">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
    </div>

    <!-- Error Toast Popup -->
    <div
      v-if="props.errorMessage"
      class="floating-popover card border-danger-subtle shadow-lg rounded-4 p-3 bg-white z-3"
    >
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="d-flex align-items-center gap-2 text-danger small fw-semibold">
          <div class="icon-circle bg-danger-subtle text-danger flex-shrink-0">
            <i class="bi bi-exclamation-circle-fill"></i>
          </div>
          <span>{{ props.errorMessage }}</span>
        </div>
        <button class="btn btn-sm btn-link text-secondary p-0 ms-2" @click="emit('clearError')">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
    </div>

    <!-- Slot Selection Confirmation Popup -->
    <div
      v-if="startTime > 0 && endTime > 0"
      class="floating-popover card border-primary-subtle shadow-lg rounded-4 p-3 bg-white z-3"
    >
      <div class="d-flex align-items-center justify-content-between gap-2 mb-2 pb-2 border-bottom">
        <span class="badge bg-primary text-white fw-bold px-2 py-1 fs-9">{{ selectedModuleCode }}</span>
        <span class="small fw-bold text-navy">{{ selectedDay }}s {{ timeString(startTime) }} – {{ timeString(endTime) }}</span>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fs-8 fw-semibold" @click="clearSelection()">
          Cancel
        </button>
        <button class="btn btn-sm btn-primary rounded-pill px-3 py-1 fs-8 fw-semibold" @click="addSelection(selectedDay, startTime, endTime, props.selectedModule)">
          <i class="bi bi-plus-lg me-1"></i> Add Slot
        </button>
      </div>
    </div>

    <!-- Slot Context and Delete Menu Popup -->
    <div
      v-if="activeSlotMenu && isEditMode()"
      class="floating-popover card border-danger-subtle shadow-lg rounded-4 p-3 bg-white z-3"
    >
      <div class="d-flex align-items-center justify-content-between gap-2 mb-2 pb-2 border-bottom">
        <span class="badge bg-navy text-white px-2 py-1 fs-9">{{ activeSlotMenu.moduleCode }}</span>
        <span class="small fw-semibold text-navy text-truncate ms-auto" style="max-width: 170px;">{{ activeSlotMenu.moduleName }}</span>
      </div>
      <div class="d-flex justify-content-between align-items-center gap-2">
        <button class="btn btn-sm btn-link text-secondary p-0 text-decoration-none fs-8" @click="activeSlotMenu = null">
          Close
        </button>
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3 py-1 fs-8 fw-semibold" @click="removeBlockByModuleName(activeSlotMenu.moduleName)">
          <i class="bi bi-trash me-1"></i> Remove Slot
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy, #141b4d);
}

.bg-surface {
  background-color: var(--app-surface, #f8f9fc);
}

.bg-navy {
  background-color: var(--app-navy, #141b4d);
}

.uppercase-day {
  letter-spacing: 0.03em;
  font-size: 0.8125rem;
}

.fs-8 {
  font-size: 0.75rem;
}

.fs-9 {
  font-size: 0.6875rem;
}

.max-w-xs {
  max-width: 18rem;
}

.schedule-block-card {
  height: 560px;
  display: flex;
  flex-direction: column;
}

@media (max-width: 767.98px) {
  .schedule-block-card {
    height: 400px;
  }
}

.grid-container-body {
  flex: 1;
  overflow: hidden;
}

.schedule-grid-scroll {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.grid-disabled {
  filter: blur(1.5px);
  pointer-events: none;
  opacity: 0.5;
}

.disabled-period-overlay {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(248, 249, 252, 0.95);
  z-index: 10;
}

.schedule-grid-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.schedule-grid-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.schedule-grid-scroll::-webkit-scrollbar-thumb {
  background: rgba(20, 27, 77, 0.15);
  border-radius: 4px;
}

table {
  cursor: pointer;
  border-color: var(--app-border, #e8eaf0) !important;
}

.timing-header,
.timing {
  position: sticky;
  left: 0;
  z-index: 2;
  min-width: 4.5rem;
  background: #f8f9fc !important;
  color: #52627a;
  text-align: center;
  border-right: 1px solid var(--app-border, #e8eaf0) !important;
}

.slot {
  height: 2.25rem;
  min-width: 6.5rem;
  user-select: none;
}

.slot:hover:not(.disabled):not(.blocked) {
  background-color: rgba(31, 78, 156, 0.12) !important;
}

.active-selection {
  background-color: var(--app-blue, #1f4e9c) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.blocked {
  background-color: var(--app-navy, #141b4d) !important;
  opacity: 0.92;
}

.disabled {
  pointer-events: none;
}

.slot-content {
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}

.quick-remove-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 1.15rem;
  height: 1.15rem;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  line-height: 1;
}

.slot.blocked:hover .quick-remove-btn {
  display: flex;
}

.floating-popover {
  position: absolute;
  bottom: 1.25rem;
  right: 1.25rem;
  width: min(calc(100% - 2.5rem), 21.5rem);
  border-color: var(--app-border, #e8eaf0) !important;
}

.icon-circle {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}
</style>