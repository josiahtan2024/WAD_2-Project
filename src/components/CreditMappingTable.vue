<script setup>
import { computed, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import AdminDrawer from '@/components/admin/AdminDrawer.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'

const props = defineProps({
  mappings: { type: Array, default: () => [] },
  admin: { type: Boolean, default: false },
  universityId: { type: [Number, String], default: null },
})
const emit = defineEmits(['changed'])
const search = ref('')
const selectedSchool = ref('')
const areas = ref([])
const formOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formError = ref('')
const deleteTarget = ref(null)
const deleteError = ref('')
const deleting = ref(false)
const form = ref(emptyForm())

function emptyForm() {
  return { module_code: '', module_name: '', description: '', language: 'English', smu_module_id: '', notes: '' }
}

watch(() => props.admin, async (enabled) => {
  if (!enabled) return
  const { data, error } = await supabase.from('smu_modules').select('id, course_area, school').order('course_area')
  if (error) formError.value = error.message
  else areas.value = data ?? []
}, { immediate: true })

function startCreate() {
  editingId.value = null
  form.value = emptyForm()
  formError.value = ''
  formOpen.value = true
}

function startEdit(mapping) {
  editingId.value = mapping.id
  form.value = {
    module_code: mapping.university_module?.module_code ?? '',
    module_name: mapping.university_module?.module_name ?? '',
    description: mapping.university_module?.description ?? '',
    language: mapping.university_module?.language ?? '',
    smu_module_id: mapping.smu_module?.id ?? '',
    notes: mapping.notes ?? '',
  }
  formError.value = ''
  formOpen.value = true
}

async function saveCourse() {
  if (!form.value.module_code.trim() || !form.value.module_name.trim() || !form.value.smu_module_id) {
    formError.value = 'Course code, course name, and SMU course area are required.'
    return
  }
  saving.value = true
  formError.value = ''
  const course = {
    module_code: form.value.module_code.trim(),
    module_name: form.value.module_name.trim(),
    description: form.value.description.trim() || null,
    language: form.value.language.trim() || null,
  }
  try {
    if (editingId.value) {
      const existing = props.mappings.find((item) => item.id === editingId.value)
      const moduleId = existing?.university_module?.id
      if (!moduleId) throw new Error('Could not find this course record.')
      const { error: courseError } = await supabase.from('university_modules').update(course).eq('id', moduleId)
      if (courseError) throw courseError
      const { error: mappingError } = await supabase.from('credit_mappings').update({
        smu_module_id: Number(form.value.smu_module_id), notes: form.value.notes.trim() || null,
      }).eq('id', editingId.value)
      if (mappingError) throw mappingError
    } else {
      const { data: created, error: courseError } = await supabase.from('university_modules')
        .insert({ ...course, university_id: props.universityId }).select('id').single()
      if (courseError) throw courseError
      const { error: mappingError } = await supabase.from('credit_mappings').insert({
        university_module_id: created.id,
        smu_module_id: Number(form.value.smu_module_id),
        notes: form.value.notes.trim() || null,
      })
      if (mappingError) {
        await supabase.from('university_modules').delete().eq('id', created.id)
        throw mappingError
      }
    }
    formOpen.value = false
    emit('changed')
  } catch (error) {
    formError.value = error.message || 'Unable to save course.'
  } finally {
    saving.value = false
  }
}

async function deleteCourse(mapping) {
  deleteTarget.value = mapping
  deleteError.value = ''
}

async function confirmDeleteCourse() {
  if (!deleteTarget.value || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    const { error } = await supabase.from('university_modules').delete().eq('id', deleteTarget.value.university_module.id)
    if (error) throw error
    deleteTarget.value = null
    emit('changed')
  } catch (error) {
    deleteError.value = error.message || 'Unable to delete course.'
  } finally {
    deleting.value = false
  }
}

const groups = computed(() => {
  const grouped = new Map()
  for (const mapping of props.mappings) {
    const area = mapping.smu_module?.course_area || 'Course area unavailable'
    const key = mapping.smu_module?.id ?? area
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        area,
        school: mapping.smu_module?.school?.trim(),
        description: mapping.smu_module?.description,
        mappings: [],
      })
    }
    grouped.get(key).mappings.push(mapping)
  }
  return [...grouped.values()].sort((a, b) =>
    a.area.localeCompare(b.area, 'en', { sensitivity: 'base' })
  )
})

const schools = computed(() =>
  [...new Set(groups.value.map((group) => group.school?.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' })
  )
)

const filteredGroups = computed(() => {
  const query = search.value.trim().toLowerCase()

  return groups.value
    .filter((group) => selectedSchool.value === '' || group.school === selectedSchool.value)
    .map((group) => ({
      ...group,
      mappings: query
        ? group.mappings.filter((mapping) =>
            [
              group.area,
              group.school,
              group.description,
              mapping.university_module?.module_code,
              mapping.university_module?.module_name,
              mapping.university_module?.description,
              mapping.university_module?.language,
              mapping.notes,
            ].some((value) => (value ?? '').toLowerCase().includes(query))
          )
        : group.mappings,
    }))
    .filter((group) => group.mappings.length)
})

const filteredCount = computed(() =>
  filteredGroups.value.reduce((count, group) => count + group.mappings.length, 0)
)

function clearFilters() {
  search.value = ''
  selectedSchool.value = ''
}
</script>

<template>
  <details class="card border rounded-4 shadow-sm overflow-hidden bg-white" data-testid="credit-mapping-table">
    <summary
      class="mapping-card-summary d-flex align-items-center justify-content-between gap-3 p-3 p-md-4"
    >
      <div>
        <h2 class="h5 fw-bold text-navy mb-1">Course Mapping</h2>
        <p class="text-muted small mb-0">
          SMU course areas mapped to courses at this partner university.
        </p>
      </div>
      <div class="d-flex align-items-center gap-2 flex-shrink-0">
        <span class="badge rounded-pill text-navy bg-surface border fw-medium px-2 py-1">
          {{ mappings.length }} {{ mappings.length === 1 ? 'course' : 'courses' }}
        </span>
        <i class="bi bi-chevron-down mapping-card-chevron text-muted" aria-hidden="true"></i>
      </div>
    </summary>
    <div class="card-body p-3 p-md-4 pt-0">
      <div v-if="admin" class="d-flex justify-content-center mb-3">
        <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1" data-testid="admin-add-course" @click="startCreate">
          <i class="bi bi-plus-lg me-1"></i>Add course
        </button>
      </div>
      <AdminDrawer
        :open="admin && formOpen"
        :title="editingId ? 'Edit Course' : 'Add Course'"
        :saving="saving"
        :error="formError"
        :form-id="'admin-course-form'"
        :submit-label="editingId ? 'Save Course' : 'Add Course'"
        @close="formOpen = false"
      >
        <form id="admin-course-form" data-testid="admin-course-form" @submit.prevent="saveCourse">
        <div class="row g-2">
          <div class="col-12 col-md-3"><label class="form-label small" for="course-code">Course code</label><input id="course-code" v-model="form.module_code" class="form-control" required data-testid="admin-course-code" /></div>
          <div class="col-12 col-md-5"><label class="form-label small" for="course-name">Course name</label><input id="course-name" v-model="form.module_name" class="form-control" required data-testid="admin-course-name" /></div>
          <div class="col-12 col-md-4"><label class="form-label small" for="course-area">SMU course area</label><select id="course-area" v-model="form.smu_module_id" class="form-select" required data-testid="admin-course-area"><option value="" disabled>Select area</option><option v-for="area in areas" :key="area.id" :value="area.id">{{ area.course_area }}{{ area.school ? ` · ${area.school}` : '' }}</option></select></div>
          <div class="col-12 col-md-6"><label class="form-label small" for="course-description">Description</label><textarea id="course-description" v-model="form.description" class="form-control" rows="2" data-testid="admin-course-description"></textarea></div>
          <div class="col-12 col-md-3"><label class="form-label small" for="course-language">Language</label><input id="course-language" v-model="form.language" class="form-control" data-testid="admin-course-language" /></div>
          <div class="col-12 col-md-3"><label class="form-label small" for="course-notes">Mapping notes</label><input id="course-notes" v-model="form.notes" class="form-control" data-testid="admin-course-notes" /></div>
        </div>
        </form>
      </AdminDrawer>
      <ConfirmDialog
        :open="!!deleteTarget"
        title="Delete Course?"
        confirm-label="Delete course"
        danger
        :working="deleting"
        :error="deleteError"
        @cancel="deleteTarget = null"
        @confirm="confirmDeleteCourse"
      >
        <p class="mb-0 small">Delete <strong class="text-navy">{{ deleteTarget?.university_module?.module_code }} · {{ deleteTarget?.university_module?.module_name }}</strong>? This action cannot be undone.</p>
      </ConfirmDialog>
      <p v-if="!mappings.length" class="text-muted small mb-0 py-3 text-center" data-testid="mapping-empty">
        No course mappings recorded for this university yet.
      </p>
      <div v-else>
        <!-- Filter Bar -->
        <div class="filter-panel mb-4 p-4 border rounded-4" data-testid="mapping-filter-bar">
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-6">
              <label for="mapping-search" class="form-label fw-semibold small text-navy"
                >Search Course Mappings</label
              >
              <div class="input-group">
                <span class="input-group-text bg-light border-end-0 text-muted"><i class="bi bi-search"></i></span>
                <input
                  id="mapping-search"
                  v-model="search"
                  type="search"
                  class="form-control border-start-0 shadow-none text-truncate"
                  placeholder="Search by SMU Course Area or Partner Courses"
                  data-testid="mapping-search"
                />
              </div>
            </div>
            <div class="col-12 col-md-6">
              <label for="mapping-school-filter" class="form-label fw-semibold small text-navy"
                >Filter by SMU School</label
              >
              <select
                id="mapping-school-filter"
                v-model="selectedSchool"
                class="form-select shadow-none text-truncate"
                data-testid="mapping-school-filter"
              >
                <option value="">All Schools</option>
                <option v-for="school in schools" :key="school" :value="school">
                  {{ school }}
                </option>
              </select>
            </div>
          </div>
          <div class="d-flex justify-content-between align-items-center gap-2 mt-4 pt-3 border-top">
            <div class="small text-secondary" data-testid="mapping-count">
              Showing <strong class="text-navy">{{ filteredCount }}</strong> of {{ mappings.length }} mapped courses
            </div>
            <button
              v-if="search || selectedSchool"
              type="button"
              class="btn btn-sm btn-outline-secondary rounded-pill px-3"
              data-testid="mapping-clear-filters"
              @click="clearFilters"
            >
              <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
            </button>
          </div>
        </div>

        <div v-if="!filteredGroups.length" class="text-muted small text-center py-4 bg-light rounded-4 border border-dashed my-3" data-testid="mapping-no-results">
          <i class="bi bi-search fs-3 mb-2 d-block text-secondary"></i>
          No course mappings match your search.
        </div>
        <div v-else class="d-flex flex-column gap-3">
          <details
            v-for="(group, index) in filteredGroups"
            :key="group.key"
            class="mapping-group border rounded-4 overflow-hidden"
            :open="!!search.trim() || selectedSchool !== '' || index === 0"
            data-testid="mapping-group"
          >
            <summary
              class="mapping-summary d-flex align-items-center justify-content-between gap-3 p-3"
            >
              <div class="min-w-0">
                <div class="fs-9 fw-bold text-uppercase text-muted tracking-wider mb-0.5">
                  SMU Course Area
                </div>
                <div class="fw-bold text-navy text-break fs-6">{{ group.area }}</div>
                <div v-if="group.school" class="badge bg-light text-secondary border fw-normal mt-1">
                  {{ group.school }}
                </div>
              </div>
              <div class="d-flex align-items-center gap-2 flex-shrink-0">
                <span class="badge rounded-pill text-navy bg-light border fw-medium px-2 py-1">
                  {{ group.mappings.length }} {{ group.mappings.length === 1 ? 'course' : 'courses' }}
                </span>
                <i class="bi bi-chevron-down mapping-chevron text-muted" aria-hidden="true"></i>
              </div>
            </summary>
            <div class="mapping-group-content mapping-scroll px-3 pb-3">
              <p v-if="group.description" class="small text-muted pt-3 mb-2">
                {{ group.description }}
              </p>
              <div
                v-for="m in group.mappings"
                :key="m.id"
                class="partner-course d-flex align-items-start gap-2 py-2 border-top"
                data-testid="mapping-row"
              >
                <i class="bi bi-arrow-right mapping-arrow mt-1 text-primary" aria-hidden="true"></i>
                <div class="min-w-0">
                  <div class="fw-semibold text-navy">
                    <span v-if="m.university_module?.module_code" class="text-primary me-1">{{
                      m.university_module.module_code
                    }}</span>
                    {{ m.university_module?.module_name || 'Course name unavailable' }}
                  </div>
                  <div v-if="m.university_module?.description" class="small text-muted mt-1">
                    {{ m.university_module.description }}
                  </div>
                  <div v-if="m.university_module?.language" class="small text-muted mt-1">
                    <i class="bi bi-translate me-1"></i>Language: {{ m.university_module.language }}
                  </div>
                  <div v-if="m.notes" class="small text-secondary mt-1 bg-light p-2 rounded-3 border">
                    <span class="fw-semibold text-navy">Notes:</span> {{ m.notes }}
                  </div>
                </div>
                <div v-if="admin" class="d-flex gap-1 ms-auto flex-shrink-0">
                  <button type="button" class="btn btn-outline-primary btn-sm" :aria-label="`Edit ${m.university_module?.module_code}`" data-testid="admin-edit-course" @click="startEdit(m)"><i class="bi bi-pencil"></i></button>
                  <button type="button" class="btn btn-outline-danger btn-sm" :aria-label="`Delete ${m.university_module?.module_code}`" data-testid="admin-delete-course" @click="deleteCourse(m)"><i class="bi bi-trash"></i></button>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  </details>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.bg-surface {
  background-color: var(--app-surface);
}

.border-dashed {
  border-style: dashed !important;
}

.fs-9 {
  font-size: 0.6875rem;
}

.tracking-wider {
  letter-spacing: 0.05em;
}

.mapping-card-summary {
  cursor: pointer;
  list-style: none;
}

.mapping-card-summary::-webkit-details-marker {
  display: none;
}

.mapping-card-chevron {
  transition: transform 150ms ease;
}

[data-testid='credit-mapping-table'][open] .mapping-card-chevron {
  transform: rotate(180deg);
}

.mapping-group {
  background: #fff;
}

.mapping-group-content {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.25rem;
}
.mapping-scroll {
  overscroll-behavior: contain;
}
.mapping-scroll::-webkit-scrollbar {
  width: 5px;
}
.mapping-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.mapping-scroll::-webkit-scrollbar-thumb {
  background: rgba(20, 27, 77, 0.15);
  border-radius: 4px;
}

.filter-panel {
  padding: 1rem;
  background: var(--app-surface, #f8f9fc);
  border: 1px solid var(--app-border, #e8eaf0);
  border-radius: var(--app-radius, 0.75rem);
}

.filter-panel .btn-outline-secondary {
  --bs-btn-color: var(--app-gray-blue);
  --bs-btn-border-color: #d5d8e5;
  --bs-btn-hover-color: #fff;
  --bs-btn-hover-bg: var(--app-gray-blue);
  --bs-btn-hover-border-color: var(--app-gray-blue);
}

.mapping-summary {
  cursor: pointer;
  list-style: none;
  background: var(--app-surface, #f8f9fc);
  border-radius: inherit;
}

.mapping-summary::-webkit-details-marker {
  display: none;
}

.mapping-group[open] .mapping-summary {
  border-bottom: 1px solid var(--app-border, #e8eaf0);
  border-radius: 0.75rem 0.75rem 0 0;
}

.mapping-chevron {
  transition: transform 150ms ease;
}

.mapping-group[open] .mapping-chevron {
  transform: rotate(180deg);
}

.partner-course:first-child {
  border-top: 0 !important;
}

.min-w-0 {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
