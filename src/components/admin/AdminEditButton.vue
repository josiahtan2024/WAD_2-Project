<script setup>
defineProps({ label: { type: String, required: true } })
</script>

<template>
  <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1 flex-shrink-0" :aria-label="`Edit ${label}`" :data-testid="`admin-edit-${label}`">
    <i class="bi bi-pencil me-1" aria-hidden="true"></i> Edit
  </button>
</template>
