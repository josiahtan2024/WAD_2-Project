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
        <button class="btn btn-link module-instructions-heading p-0 text-decoration-none text-start text-body fw-bold" type="button" :aria-expanded="!collapsed" @click="collapsed=!collapsed">
          <span>
            <span class="h5 d-block mb-1">{{ props.action === 'Insert/Update' ? 'Add or Update Modules' : `${props.action} Modules` }}</span>
            <span class="small fw-normal text-secondary">{{ props.color === 'danger' ? 'Remove selected modules from this timetable.' : 'Choose a module, then select its time on the timetable.' }}</span>
          </span>
        </button>
        <button class="btn btn-sm btn-outline-secondary module-collapse-toggle flex-shrink-0" type="button" :aria-expanded="!collapsed" :aria-label="collapsed ? `Expand ${props.action} instructions` : `Collapse ${props.action} instructions`" @click="collapsed=!collapsed">
          <i :class="collapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up'" aria-hidden="true"></i>
        </button>
      </div>
      <div class="flex-column mx-xs-auto mx-sm-0 pt-2" :class="{'d-flex':!collapsed,'d-none':collapsed}">
        <template v-for="(ins,i) in props.instructions" :key="i">
            <div class="d-flex flex-row align-items-center mb-2">
                <div class="instruction-number rounded-circle me-2 fw-bold">{{ i+1 }}</div>
                <div>{{ins}}</div>
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
  flex: 0 0 2rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #e9edf5;
}
.module-instructions-heading {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  margin-left: -0.5rem;
  padding: 0.35rem 0.5rem !important;
  border-radius: 0.5rem;
  transition: color 150ms ease, background-color 150ms ease;
}
.module-instructions-heading > span:last-child { min-width: 0; }
.schedule-instructions-danger .module-collapse-toggle:hover {
  color: #dc3545 !important;
  border-color: #dc3545;
  background-color: #fff0f1;
}
.schedule-instructions-info .module-collapse-toggle:hover {
  color: #495057 !important;
  border-color: #adb5bd;
  background-color: #eef1f4;
}
</style>
