<script setup>
defineProps({ label: { type: String, required: true } })
</script>

<template>
  <button type="button" class="btn btn-outline-secondary btn-sm flex-shrink-0" :aria-label="`Edit ${label}`" :data-testid="`admin-edit-${label}`">
    <i class="bi bi-pencil" aria-hidden="true"></i> Edit
  </button>
</template>
