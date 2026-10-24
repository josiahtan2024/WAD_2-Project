<script setup>
import {ref} from 'vue';
const props = defineProps({
    'action':String,
    'instructions':Array,
    'color':String,
    
})
const collapsed = ref(props.action!='Insert'); // LEAVE IT OPEN BY DEFAULT IF USER IS CREATING A NEW SCHEDULE
</script>
<template>
    
    <div class='alert' :class="`alert-${props.color}`">
      <div  class="d-flex justify-content-center">
        <div class="text-center" @click="collapsed=!collapsed"><h3 >
        To {{props.action}} Modules:</h3></div>
        <div class="position-absolute top-0 end-0 m-2">
          <button :class="`btn btn-sm border-2 btn-outline-${props.color}`" type="button" @click="collapsed=!collapsed">
            <template v-if="collapsed">
              &#9660;
            </template>
            <template v-else>
              &#9650;
            </template>
          </button>
           
        </div>
      </div>
      <div class="flex-column mx-xs-auto mx-sm-0" :class="{'d-flex':!collapsed,'d-none':collapsed}">
        <template v-for="(ins,i) in props.instructions" :key="i">
            <div class="d-flex flex-row align-items-center mb-2">
                <div class="rounded p-2 border border-dark-subtle me-2 fw-bold">{{ i+1 }}</div>
                <div>{{ins}}</div>
                <template v-if="i==0"><i class="bi bi-info-circle-fill ms-2 text-info" type="button" data-bs-toggle="collapse" data-bs-target="#mod-data"></i></template>
            </div>
        </template>
        
        <slot name="form"></slot>
        
      </div>
    </div>
</template>
<style scoped>
h3{
  cursor: pointer;
}
</style>