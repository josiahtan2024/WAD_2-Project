<script setup>
import { useScheduleStore } from '@/stores/schedule'
import { computed } from 'vue'

const props = defineProps({
  selectedModule: { type: String, default: '' },
  isEditing: { type: Boolean, default: false },
  changesMade: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  discarding: { type: Boolean, default: false },
})

const emit = defineEmits(['selectModule', 'toggleEdit', 'save', 'discard'])
const schedule = useScheduleStore()

const scheduledModuleNames = computed(() => {
  const names = new Set()
  if (!schedule.currentSchedule) return names

  for (const day in schedule.currentSchedule) {
    const slots = schedule.currentSchedule[day] || []
    for (const slot of slots) {
      if (slot.moduleName) {
        names.add(slot.moduleName)
      }
    }
  }
  return names
})

function isScheduled(modName) {
  return scheduledModuleNames.value.has(modName)
}

function handleSelect(modName) {
  // Prevent selecting modules that are already placed on the timetable
  if (isScheduled(modName)) return
  emit('selectModule', modName)
}

function handleCancel() {
  emit('selectModule', '')
  emit('discard')
}

function handleSave() {
  emit('selectModule', '')
  emit('save')
}
</script>

<template>
  <div class="card border rounded-4 shadow-sm bg-white overflow-hidden module-table-card" data-testid="module-table">
    <div class="card-header bg-white p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2 flex-shrink-0">
      <div>
        <div class="d-flex align-items-center gap-2">
        <h3 class="h6 fw-bold text-navy mb-0 d-inline-flex align-items-center gap-2">
          Module Reference
          <span class="badge text-navy bg-surface border fw-medium rounded-pill align-middle" style="font-size: 0.75em; padding: 0.25em 0.5em;">
            {{ schedule.moduleData.length }}
          </span>
        </h3>
        </div>
        <p class="text-muted fs-8 mb-0 mt-1">
          {{ isEditing ? 'Select a module, then click the timetable slots to place it.' : 'Click "Edit Schedule" to start planning your timetable.' }}
        </p>
      </div>

      <div class="d-flex align-items-center gap-2">
        <template v-if="isEditing">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-2 flex-shrink-0"
            :disabled="discarding || saving"
            @click="handleCancel">Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm rounded-pill px-3 py-2 flex-shrink-0"
            :disabled="saving || discarding"
            @click="handleSave">Save
          </button>
        </template>

        <button v-else type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-2 flex-shrink-0"
        data-testid="schedule-edit-toggle-btn"
        @click="emit('toggleEdit')">
          <i class="bi bi-pencil me-1" aria-hidden="true"></i> Edit Schedule
        </button>
      </div>
    </div>

    <div class="card-body p-3 module-list-scroll">
      <div v-if="!schedule.moduleData.length" class="text-muted small py-4 text-center border border-dashed rounded-3 bg-surface h-100 d-flex flex-column align-items-center justify-content-center">
        <i class="bi bi-book fs-3 text-secondary d-block mb-1"></i>
        <span>No modules added to reference yet.</span>
      </div>

      <!-- Module List -->
      <div v-else class="d-flex flex-column gap-2">
        <div
          v-for="mod in schedule.moduleData"
          :key="mod.id"
          class="module-select-item d-flex align-items-center justify-content-between gap-3 p-3 rounded-3 border transition-all flex-shrink-0"
          :class="[
            selectedModule === mod.module_name ? 'is-selected border-primary bg-primary-subtle shadow-2xs' : 'bg-surface',
            isScheduled(mod.module_name) ? 'is-disabled-item opacity-75' : (isEditing ? 'cursor-pointer' : '')
          ]"
          @click="isEditing && handleSelect(mod.module_name)"
        >
          <div class="d-flex align-items-center gap-3 min-w-0">
            <i
              v-if="isEditing"
              class="bi transition-all fs-6 flex-shrink-0"
              :class="[
                isScheduled(mod.module_name)
                  ? 'bi-check-circle-fill text-success'
                  : selectedModule === mod.module_name
                    ? 'bi-pin-angle-fill text-primary scale-110'
                    : 'bi-pin-angle text-muted'
              ]"
            ></i>
            <span class="text-navy small fw-semibold text-break d-block line-clamp-2" :class="{ 'text-muted': isScheduled(mod.module_name) && isEditing }">
              {{ mod.module_name }}
            </span>
          </div>

          <div class="d-flex align-items-center gap-2 flex-shrink-0">
            <span
              v-if="isScheduled(mod.module_name)"
              class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fs-9 px-2 py-1 d-none d-md-inline"
            >
              Placed
            </span>
            <span class="badge bg-white text-primary border fw-bold code-badge">
              {{ mod.module_code }}
            </span>
          </div>
        </div>
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

.border-dashed {
  border-style: dashed !important;
}

.cursor-pointer {
  cursor: pointer;
}

.fs-8 {
  font-size: 0.75rem;
}

.fs-9 {
  font-size: 0.6875rem;
}

.module-table-card {
  height: 560px;
  display: flex;
  flex-direction: column;
}

@media (max-width: 767.98px) {
  .module-table-card {
    height: 400px;
  }
}

.module-list-scroll {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.module-list-scroll::-webkit-scrollbar {
  width: 6px;
}
.module-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.module-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(20, 27, 77, 0.15);
  border-radius: 4px;
}

.module-select-item {
  border-color: var(--app-border, #e8eaf0) !important;
  min-height: 2.75rem;
}

.module-select-item.cursor-pointer:hover {
  border-color: var(--bs-primary) !important;
  transform: translateX(2px);
}

.is-disabled-item {
  cursor: not-allowed !important;
  background-color: #f1f3f9 !important;
}

.is-selected {
  background-color: rgba(31, 78, 156, 0.08) !important;
}

.code-badge {
  border-color: #dbe4f0 !important;
  letter-spacing: 0.02em;
}

.scale-110 {
  transform: scale(1.15);
}

.min-w-0 {
  min-width: 0;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>