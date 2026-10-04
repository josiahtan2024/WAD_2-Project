<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
// Leaflet (https://leafletjs.com), BSD-2. Map tiles (c) OpenStreetMap contributors.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({ universities: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])

const el = ref(null)
let map
let layer

function draw() {
  if (!map) return
  layer.clearLayers()
  props.universities
    .filter((u) => u.lat != null && u.lng != null)
    .forEach((u) => {
      // circleMarker avoids Leaflet's default icon image path problem under Vite
      L.circleMarker([u.lat, u.lng], { radius: 9, color: '#1f4e9c', fillOpacity: 0.8 })
        .on('click', () => emit('select', u))
        .bindTooltip(u.name)
        .addTo(layer)
    })
}

onMounted(() => {
  map = L.map(el.value).setView([30, 20], 2)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  layer = L.layerGroup().addTo(map)
  draw()
})
watch(() => props.universities, draw)
onBeforeUnmount(() => map?.remove())
</script>

<template>
  <div ref="el" class="map-panel rounded" data-testid="map-panel"></div>
</template>

<style scoped>
.map-panel { height: 420px; width: 100%; }
</style>
