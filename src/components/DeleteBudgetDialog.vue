<script setup>
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue'
import { watch, onUnmounted } from 'vue'

const props = defineProps({
  budget: { type: Object, default: null },
  deleting: { type: Boolean, default: false },
})

const emit = defineEmits(['cancel', 'confirm'])

watch(
  () => props.budget,
  (newVal) => {
    if (newVal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <DeleteConfirmDialog
    :open="!!budget"
    title="Delete Budget?"
    action-label="Delete"
    working-label="Deleting…"
    close-label="Cancel"
    :working="deleting"
    @cancel="emit('cancel')"
    @confirm="emit('confirm')"
  >
    <template #description>
      Delete the budget for <strong class="text-navy">{{ budget?.university_name }}</strong>? 
      <br>This action cannot be undone.
    </template>
  </DeleteConfirmDialog>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}
</style>