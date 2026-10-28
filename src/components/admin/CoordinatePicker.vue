<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
// Leaflet (https://leafletjs.com), BSD-2. Map tiles (c) OpenStreetMap contributors.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  lat: { type: [Number, String], default: '' },
  lng: { type: [Number, String], default: '' },
})
const emit = defineEmits(['pick'])

const el = ref(null)
let map
let marker

function position() {
  const lat = Number(props.lat)
  const lng = Number(props.lng)
  const filled = String(props.lat).trim() !== '' && String(props.lng).trim() !== ''
  const valid = filled && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  return valid ? [lat, lng] : null
}

function draw() {
  const point = position()
  if (!point) {
    marker?.remove()
    marker = null
    return
  }
  if (marker) marker.setLatLng(point)
  else marker = L.circleMarker(point, { radius: 9, color: '#1f4e9c', weight: 2, fillColor: '#1f4e9c', fillOpacity: 0.8 }).addTo(map)
}

onMounted(() => {
  const point = position()
  map = L.map(el.value).setView(point ?? [30, 20], point ? 6 : 1)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  map.on('click', (event) => {
    emit('pick', { lat: event.latlng.lat.toFixed(4), lng: event.latlng.wrap().lng.toFixed(4) })
  })
  draw()
})

watch(() => [props.lat, props.lng], () => {
  draw()
  const point = position()
  if (point) map.panTo(point)
})

onBeforeUnmount(() => map?.remove())
</script>

<template>
  <div ref="el" class="coordinate-picker rounded border" aria-label="Click the map to place the pin" data-testid="coordinate-picker"></div>
</template>

<style scoped>
.coordinate-picker { height: 220px; width: 100%; }
</style>
