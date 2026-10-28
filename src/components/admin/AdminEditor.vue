<script setup>
import { computed, ref, watch } from 'vue'
import { useAdminUniversitiesStore } from '@/stores/adminUniversities'
import AdminDrawer from '@/components/admin/AdminDrawer.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import LocationForm from '@/components/admin/LocationForm.vue'
import DetailsForm from '@/components/admin/DetailsForm.vue'
import CostForm from '@/components/admin/CostForm.vue'
import AcademicsForm from '@/components/admin/AcademicsForm.vue'
import PeriodsForm from '@/components/admin/PeriodsForm.vue'
import BudgetNotice from '@/components/BudgetNotice.vue'

const props = defineProps({
  university: { type: Object, default: null }, // null while adding a new one
  details: { type: Object, default: () => ({ languages: [], modules: [], periods: [] }) },
  section: { type: String, default: null }, // create | details | location | cost | academics | exchange | delete
})
const emit = defineEmits(['update:section', 'changed', 'created', 'deleted'])

const admin = useAdminUniversitiesStore()
const error = ref('')
const notice = ref('')
const impact = ref(null)
let noticeTimer

const TITLES = {
  create: 'Add a university',
  details: 'Edit details',
  location: 'Edit location',
  cost: 'Edit costs',
  academics: 'Edit academics',
  exchange: 'Edit exchange periods',
}

const cost = computed(() => {
  const value = props.university?.university_costs
  return Array.isArray(value) ? value[0] : value
})
const drawerOpen = computed(() => props.section in TITLES)
const languages = computed(() => props.details.languages.map((l) => l.instruction_language))

function close() {
  emit('update:section', null)
}

function say(message) {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 4000)
}

async function save(work, message) {
  if (admin.saving) return
  error.value = ''
  try {
    await work()
    say(message)
    close()
  } catch (e) {
    error.value = e.message
  } finally {
    emit('changed')
  }
}

const id = () => props.university.id

const saveDetails = ({ fields, logo }) => save(() => admin.updateWithLogo(props.university, fields, logo), 'Details saved.')
const saveLocation = (fields) => save(() => admin.update(id(), fields), 'Location saved.')
const saveCost = (values) => save(() => admin.saveCost(id(), values), 'Costs saved.')
const savePeriods = (rows) => save(() => admin.savePeriods(id(), rows), 'Exchange periods saved.')
const saveAcademics = ({ languages: names, modules_url }) =>
  save(async () => {
    await admin.saveLanguages(id(), names)
    await admin.update(id(), { modules_url })
  }, 'Academics saved.')

async function create(fields) {
  if (admin.saving) return
  error.value = ''
  try {
    const created = await admin.create(fields)
    close()
    emit('created', created)
  } catch (e) {
    error.value = e.message
  }
}

async function confirmDelete() {
  if (admin.saving) return
  error.value = ''
  try {
    const { id } = props.university
    await admin.remove(props.university)
    close()
    emit('deleted', id)
  } catch (e) {
    error.value = e.message
  }
}

watch(
  () => props.section,
  async (section) => {
    error.value = ''
    impact.value = null
    if (section !== 'delete') return
    try {
      impact.value = await admin.impact(props.university.id)
    } catch (e) {
      error.value = e.message
    }
  },
)
</script>

<template>
  <AdminDrawer :open="drawerOpen" :title="TITLES[section] ?? ''" :saving="admin.saving" :error="error" :submit-label="section === 'create' ? 'Add university' : 'Save'" @close="close">
    <LocationForm v-if="section === 'create'" with-name @submit="create" />
    <DetailsForm v-else-if="section === 'details'" :university="university" @submit="saveDetails" />
    <LocationForm v-else-if="section === 'location'" :university="university" @submit="saveLocation" />
    <CostForm v-else-if="section === 'cost'" :cost="cost" @submit="saveCost" />
    <AcademicsForm v-else-if="section === 'academics'" :languages="languages" :modules-url="university.modules_url ?? ''" @submit="saveAcademics" />
    <PeriodsForm v-else-if="section === 'exchange'" :periods="details.periods" @submit="savePeriods" />
  </AdminDrawer>

  <ConfirmDialog
    :open="section === 'delete'"
    title="Delete this university?"
    confirm-label="Delete permanently"
    danger
    :working="admin.saving"
    :error="error"
    :type-to-confirm="university?.name ?? ''"
    @cancel="close"
    @confirm="confirmDelete"
  >
    <p class="mb-2"><strong>{{ university?.name }}</strong> and everything saved against it will be erased. This cannot be undone.</p>
    <ul v-if="impact" class="mb-0" data-testid="delete-impact">
      <li>{{ impact.shortlists }} student {{ impact.shortlists === 1 ? 'shortlist' : 'shortlists' }}</li>
      <li>{{ impact.budgets }} {{ impact.budgets === 1 ? 'budget' : 'budgets' }}</li>
      <li>{{ impact.reviews }} {{ impact.reviews === 1 ? 'review' : 'reviews' }} and their comments</li>
      <li>{{ impact.timetables }} {{ impact.timetables === 1 ? 'timetable' : 'timetables' }}</li>
    </ul>
    <p v-else class="mb-0 small">Checking what would be lost...</p>
  </ConfirmDialog>

  <BudgetNotice :success-message="notice" @dismiss-success="notice = ''" />
</template>
