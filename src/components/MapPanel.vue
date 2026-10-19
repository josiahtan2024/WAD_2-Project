<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
// Leaflet (https://leafletjs.com), BSD-2. Map tiles (c) OpenStreetMap contributors.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  universities: {
    type: Array,
    default: () => [],
  },
  selectedId: {
    type: [Number, String],
    default: null,
  },
})
const emit = defineEmits(['select'])

const el = ref(null)
let map
let layer

const markers = new Map()

function updateSelectedMarker() {
  markers.forEach((marker, id) => {
    const isSelected = id === props.selectedId

    marker.setStyle({
      color: isSelected ? '#ffffff' : '#1f4e9c',
      weight: isSelected ? 3 : 2,
      opacity: 1,
      fillColor: isSelected ? '#7dd3fc' : '#1f4e9c',
      fillOpacity: isSelected ? 1 : 0.8,
    })

    marker.setRadius(isSelected ? 11 : 9)
  })
  markers.get(props.selectedId)?.bringToFront()
}

function focusSelectedUniversity() {
  if (!map || props.selectedId == null) return

  const marker = markers.get(props.selectedId)
  if (!marker) return

  map.flyTo(marker.getLatLng(), 15, {
    animate: true,
    duration: 1.5,
  })
}

function draw() {
  if (!map || !layer) return

  layer.clearLayers()
  markers.clear()

  props.universities.forEach((u) => {
    if (
      u.lat == null || u.long == null ||
      String(u.lat).trim() === '' ||
      String(u.long).trim() === ''
    ) return

    const lat = Number(u.lat)
    const lng = Number(u.long)

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 || lat > 90 ||
      lng < -180 || lng > 180
    ) return

    const tooltip = document.createElement('span')
    tooltip.textContent = u.name ?? ''

    const marker = L.circleMarker([lat, lng], {
  radius: 9,
  color: '#1f4e9c',
  weight: 2,
  fillColor: '#1f4e9c',
  fillOpacity: 0.8,
})
  .on('click', () => emit('select', u))
  .bindTooltip(tooltip)
  .addTo(layer)

markers.set(u.id, marker)

  })

  updateSelectedMarker()
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
watch(
  () => props.selectedId,
  () => {
    updateSelectedMarker()
    focusSelectedUniversity()
  }
)
onBeforeUnmount(() => map?.remove())
</script>

<template>
  <div ref="el" class="map-panel rounded" data-testid="map-panel"></div>
</template>

<style scoped>
.map-panel { height: 420px; width: 100%; }
</style>
