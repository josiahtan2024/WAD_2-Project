<script setup>
const props = defineProps({
    unisToCompare: {
        type: Array,
        required: true
    },
    specialRowClass: {
        type: String,
        default: ''
    },
    specialVforClass: {
        type: String,
        default: ''
    },
    specialVifClass: {
        type: String,
        default: ''
    },
    renderDropdown: {
        type: Boolean,
        default: false
    }
})
</script>

<template>
    <div class="row justify-content-center" :class="props.specialRowClass">
        <div v-for="(uni, idx) in props.unisToCompare" :key="idx" 
        class="col-6 col-lg-4"
        :class="{'d-none d-lg-block': idx === 2}, props.specialVforClass">
            <div v-if="uni || props.renderDropdown" :class="props.specialVifClass">
                <slot :uni="uni" :idx="idx"></slot>
            </div>

            <div v-else>
                <slot name="empty" :idx="idx"></slot>
            </div>
        </div>
    </div>
</template>