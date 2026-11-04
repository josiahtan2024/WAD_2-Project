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
      <div class="d-flex justify-content-center">
        <div class="card-title" @click="collapsed = !collapsed">
          <h4>{{ props.action }} Modules</h4>
        </div>
        <div class="position-absolute top-0 end-0 m-2">
          <button class="btn btn-sm btn-outline-dark" type="button" @click="collapsed = !collapsed">
            <template v-if="collapsed"> &#9660; </template>
            <template v-else> &#9650; </template>
          </button>
        </div>
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
</style>
