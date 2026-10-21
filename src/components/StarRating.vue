<script setup>
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  label: { type: String, required: true },
  testid: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue'])

// clicking the current star again clears it, so optional topics can go back to unrated
function pick(n) {
  emit('update:modelValue', n === props.modelValue ? 0 : n)
}
</script>

<template>
  <div class="d-flex align-items-center gap-2" role="radiogroup" :aria-label="label">
    <span class="small text-muted" style="min-width: 7.5rem">{{ label }}</span>
    <button
      v-for="n in 5"
      :key="n"
      type="button"
      role="radio"
      class="btn btn-link p-0 fs-4 lh-1 text-decoration-none"
      :class="n <= modelValue ? 'text-warning' : 'text-secondary'"
      :aria-checked="n === modelValue"
      :aria-label="`${n} out of 5`"
      :data-testid="`${testid}-${n}`"
      @click="pick(n)"
    >&#9733;</button>
  </div>
</template>
