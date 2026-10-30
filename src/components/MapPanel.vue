<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

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
const emit = defineEmits(['select', 'reset'])

const el = ref(null)
let map
let clusterGroup

const markers = new Map()
const DEFAULT_CENTER = [20, 0]
const DEFAULT_ZOOM = 1.5

function resetMap() {
  if (!map) return

  map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
    animate: true,
    duration: 1.4,
  })

  emit('reset')
}

function createUniversityIcon(isSelected = false) {
  return L.divIcon({
    className: 'university-marker-wrapper',
    html: `<div class="university-marker ${isSelected ? 'selected' : ''}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function updateSelectedMarker() {
  markers.forEach((marker, id) => {
    const isSelected = String(id) === String(props.selectedId)

    marker.setIcon(createUniversityIcon(isSelected))
    marker.setZIndexOffset(isSelected ? 1000 : 0)
  })
}

function focusSelectedUniversity() {
  if (!map || props.selectedId == null) return

  const marker = markers.get(String(props.selectedId))
  if (!marker) return

  const latLng = marker.getLatLng()

  // Zoom in to the selected university, even if it is clustered.
  clusterGroup.zoomToShowLayer(marker, () => {
    map.flyTo(latLng, 15, {
      animate: true,
      duration: 1.8,
    })
  })
}

function draw() {
  if (!map || !clusterGroup) return

  clusterGroup.clearLayers()
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

    const marker = L.marker([lat, lng], {
      icon: createUniversityIcon(
        String(u.id) === String(props.selectedId)
      ),
    })
      .bindTooltip(tooltip)
      .on('click', () => emit('select', u))

    clusterGroup.addLayer(marker)
    markers.set(String(u.id), marker)
  })

  updateSelectedMarker()
}

onMounted(() => {
  map = L.map(el.value, {
    minZoom: 1,
    worldCopyJump: true,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 70,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    animate: true,
  })

  map.addLayer(clusterGroup)

  draw()

  // Only focus if a selectedId is explicitly passed on load, otherwise keep the default reset view
  if (props.selectedId != null) {
    focusSelectedUniversity()
  } else {
    resetMap()
  }
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(
  () => props.selectedId,
  () => {
    updateSelectedMarker()
    focusSelectedUniversity()
  }
)

watch(
  () => props.universities,
  draw,
  { deep: true }
)
</script>

<template>
  <div class="map-container">
    <div ref="el" class="map-panel rounded" data-testid="map-panel"></div>

    <button
      type="button"
      class="map-reset-button"
      @click="resetMap"
      aria-label="Reset map to world view"
      title="Reset map"
    >
      <i class="bi bi-globe"></i>
      Reset map
    </button>
  </div>
</template>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
}

.map-panel {
  height: 420px;
  width: 100%;
}

:deep(.university-marker-wrapper) {
  background: transparent;
  border: none;
}

:deep(.university-marker) {
  width: 18px;
  height: 18px;
  background: #1f4e9c;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.35);
  transition: all 0.2s ease;
}

:deep(.university-marker.selected) {
  width: 22px;
  height: 22px;
  background: #7dd3fc;
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 3px #1f4e9c;
}

:deep(.marker-cluster) {
  background-clip: padding-box;
  border-radius: 20px;
}

:deep(.marker-cluster-small),
:deep(.marker-cluster-medium),
:deep(.marker-cluster-large) {
  background-color: rgba(31, 78, 156, 0.3);
}

:deep(.marker-cluster-small div),
:deep(.marker-cluster-medium div),
:deep(.marker-cluster-large div) {
  background-color: #1f4e9c;
  color: white;
  font-weight: 600;
  font-family: inherit;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.map-reset-button {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  color: #1f4e9c;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.map-reset-button:hover {
  background: #f0f5ff;
}
</style>