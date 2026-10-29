<script setup>
import {ref} from 'vue';
const props = defineProps({
    'action':String,
    'instructions':Array,
    'modules':Array,
    'color':String,
    
})
const collapsed = ref(props.action!='Insert'); // LEAVE IT OPEN BY DEFAULT IF USER IS CREATING A NEW SCHEDULE
</script>
<template>
    
    <section class="schedule-instructions rounded-4 p-3 p-md-4 mb-4" :class="`schedule-instructions-${props.color}`">
      <div class="d-flex align-items-center justify-content-between gap-3">
        <button class="btn btn-link p-0 text-decoration-none text-start text-body fw-bold" type="button" :aria-expanded="!collapsed" @click="collapsed=!collapsed">
          <span class="h5 mb-0">{{ props.action }} Modules</span>
        </button>
        <button class="btn btn-sm btn-outline-secondary flex-shrink-0" type="button" :aria-expanded="!collapsed" :aria-label="collapsed ? `Expand ${props.action} instructions` : `Collapse ${props.action} instructions`" @click="collapsed=!collapsed">
          <i :class="collapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up'" aria-hidden="true"></i>
        </button>
      </div>
      <div class="flex-column mx-xs-auto mx-sm-0" :class="{'d-flex':!collapsed,'d-none':collapsed}">
        <template v-for="(ins,i) in props.instructions" :key="i">
            <div class="d-flex flex-row align-items-center mb-2">
                <div class="instruction-number rounded-circle me-2 fw-bold">{{ i+1 }}</div>
                <div>{{ins}}</div>
                <template v-if="i==0"><button class="btn btn-link p-0 ms-2" type="button" data-bs-toggle="collapse" data-bs-target="#mod-data" aria-controls="mod-data" aria-label="Open module reference"><i class="bi bi-info-circle-fill text-primary" aria-hidden="true"></i></button></template>
            </div>
        </template>
        <slot name="form"></slot>
      </div>
    </section>
</template>
<style scoped>
.schedule-instructions {
  background: #f8f9fc;
  border: 1px solid #e8eaf0;
}
.schedule-instructions-danger {
  border-color: #f1c6cb;
  background: #fff8f8;
}
.instruction-number {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  background: #e9edf5;
}
</style>
