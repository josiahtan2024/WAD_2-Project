<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import AppFooter from '@/components/AppFooter.vue'

const route = useRoute()
const showFooter = computed(() => route.name !== 'home')
</script>

<template>
  <div class="app-shell">
    <NavBar />

    <main class="flex-grow-1">
      <RouterView />
    </main>

    <AppFooter v-if="showFooter"/>
  </div>
</template>
