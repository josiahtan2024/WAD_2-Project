<script setup>
import {ref} from 'vue';
import {useScheduleStore} from "@/stores/schedule"

const schedule = useScheduleStore();


</script>

<template>
    

    <div class="card shadow-sm rounded-4 mb-4">
        <div class="card-body p-4">
            <div class="text-center">
            <h4 class="fw-bold mb-4">
                Module Reference
            </h4>
            </div>
            <div v-for="mod in schedule.moduleData" class="d-flex justify-content-between gap-3 mb-3" :key="mod.id">
            <span class="text-secondary">{{ mod.module_name }}</span>
            <span class="fw-semibold text-end">{{ mod.module_code }}</span>
            </div>
        </div>
    </div>
    

</template>

<style scoped>
</style>