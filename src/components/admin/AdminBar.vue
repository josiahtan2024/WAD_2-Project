<script setup>
import { computed, ref } from 'vue'
import { useAdminUniversitiesStore } from '@/stores/adminUniversities'

const props = defineProps({
  university: { type: Object, required: true },
  details: { type: Object, default: () => ({ languages: [], modules: [], periods: [] }) },
})
const emit = defineEmits(['edit', 'changed'])

const admin = useAdminUniversitiesStore()
const error = ref('')

const hidden = computed(() => props.university.published === false)

// what a student would find missing on this page
const missing = computed(() => {
  const cost = props.university.university_costs
  const list = []
  if (!props.university.logo_url) list.push('a logo')
  if (props.university.lat == null || props.university.long == null) list.push('a map location')
  if (!(Array.isArray(cost) ? cost[0] : cost)) list.push('costs')
  if (!props.details.languages.length) list.push('languages')
  if (!props.details.periods.length) list.push('exchange periods')
  return list
})

async function setPublished(published) {
  error.value = ''
  try {
    await admin.setPublished(props.university.id, published)
    emit('changed')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="mb-3" data-testid="admin-bar">
    <div v-if="hidden" class="alert alert-warning d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2" role="status" data-testid="admin-hidden-banner">
      <div>
        <strong>Hidden from students.</strong>
        <span v-if="missing.length"> Still missing: {{ missing.join(', ') }}.</span>
        <span v-else> Everything is filled in, so it is ready to publish.</span>
      </div>
      <button type="button" class="btn btn-warning btn-sm" :disabled="admin.saving" data-testid="admin-publish" @click="setPublished(true)">Publish</button>
    </div>

    <div class="d-flex flex-wrap align-items-center justify-content-end gap-2">
      <span class="badge text-bg-warning me-auto">Staff</span>
      <button type="button" class="btn btn-outline-primary btn-sm" data-testid="admin-edit-details" @click="emit('edit', 'details')">
        <i class="bi bi-pencil" aria-hidden="true"></i> Edit Details
      </button>
      <button v-if="!hidden" type="button" class="btn btn-outline-secondary btn-sm" :disabled="admin.saving" data-testid="admin-hide" @click="setPublished(false)">
        <i class="bi bi-eye-slash" aria-hidden="true"></i> Hide From Students
      </button>
      <button
        type="button"
        class="btn btn-outline-danger btn-sm"
        :disabled="!hidden"
        :title="hidden ? '' : 'Hide this university before deleting it'"
        data-testid="admin-delete"
        @click="emit('edit', 'delete')"
      >
        <i class="bi bi-trash" aria-hidden="true"></i> Delete
      </button>
    </div>
    <div v-if="error" class="text-danger small text-end mt-1" role="alert" data-testid="admin-bar-error">{{ error }}</div>
  </div>
</template>
