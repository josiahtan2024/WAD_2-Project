<script setup>
import NavBar from '@/components/NavBar.vue'
import AppFooter from '@/components/AppFooter.vue'
</script>

<template>
  <div class="app-shell">
    <NavBar />
    <main class="container-xl py-4 flex-grow-1">
      <RouterView />
    </main>
    <AppFooter />
  </div>
</template>
