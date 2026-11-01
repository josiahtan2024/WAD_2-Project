<script setup>
const props = defineProps({
    unisToCompare: {
        type: Array,
        required: true
    }
})
</script>

<template>
    <div class="row" v-if="props.unisToCompare.some(uni => uni)">
        <div :class="{
        'col-6 col-lg-4': !props.unisToCompare[1] && !props.unisToCompare[2],
        'col-12 col-lg-8': !props.unisToCompare[2] && props.unisToCompare[1],
        'col-12': props.unisToCompare[2]       
        }">
            <div class="mt-5 pt-5 pb-3 border-bottom">
                <div class="fw-semibold"><slot></slot></div>
            </div>
        </div>
    </div>
</template>