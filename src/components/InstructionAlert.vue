<script setup>
import { ref } from 'vue'
const props = defineProps({
  action: String,
  instructions: Array,
})
const collapsed = ref(props.action != 'Insert') // LEAVE IT OPEN BY DEFAULT IF USER IS CREATING A NEW SCHEDULE
</script>
<template>
  <div class="card mb-3">
    <div class="card-body">
      <div class="instruction-header d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2 mb-3">
        <div class="card-title mb-0 text-center text-sm-start" @click="collapsed = !collapsed">
          <h4 class="mb-0">{{ props.action }} Modules</h4>
        </div>
        <button class="btn btn-sm btn-outline-dark instruction-toggle" type="button" @click="collapsed = !collapsed">
          <i :class="['bi', collapsed ? 'bi-chevron-down' : 'bi-chevron-up']" class="me-1" aria-hidden="true"></i>
          {{ collapsed ? 'Show' : 'Hide' }} Instructions
        </button>
      </div>
      <div
        class="flex-column mx-xs-auto mx-sm-0"
        :class="{ 'd-flex': !collapsed, 'd-none': collapsed }"
      >
        <template v-for="(ins, i) in props.instructions" :key="i">
          <div class="d-flex flex-row align-items-center mb-2">
            <div class="rounded p-2 border border-dark-subtle me-2 fw-bold">{{ i + 1 }}</div>
            <div>{{ ins }}</div>
          </div>
        </template>
        <slot name="form"></slot>
      </div>
    </div>
  </div>
</template>
<style scoped>
.card-title {
  cursor: pointer;
}

.instruction-toggle {
  flex-shrink: 0;
}

@media (max-width: 575.98px) {
  .instruction-toggle {
    width: 100%;
  }
}
</style>
