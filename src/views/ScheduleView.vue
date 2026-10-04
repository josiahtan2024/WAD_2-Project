<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useScheduleStore } from '@/stores/schedule'
import { useUniversitiesStore } from '@/stores/universities'
import WeeklyGrid from '@/components/WeeklyGrid.vue'
import ScheduleBlock from '@/components/ScheduleBlock.vue'

const route = useRoute()
const schedule = useScheduleStore()
const uni = useUniversitiesStore()
const saving = ref(false)
const saved = ref(false)

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

onMounted(async () => {
  try {
    await uni.loadMappings(route.params.universityId)
    await schedule.load(route.params.universityId)
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
      <div class="col-12 col-lg-9">
        <WeeklyGrid />
      </div>
    </div>
  </section>
</template>
