<script setup>
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue'

defineProps({
  budget: { type: Object, default: null },
  deleting: { type: Boolean, default: false },
})

const emit = defineEmits(['cancel', 'confirm'])
</script>

<template>
  <DeleteConfirmDialog
    :open="!!budget"
    title="Delete This Budget?"
    action-label="Delete Budget"
    working-label="Deleting…"
    close-label="Cancel deletion"
    :working="deleting"
    @cancel="emit('cancel')"
    @confirm="emit('confirm')"
  >
    <template #description>
      Are you sure you want to delete the budget for
      <strong>{{ budget?.university_name }}</strong>?
      This action cannot be undone.
    </template>
  </DeleteConfirmDialog>
</template>
