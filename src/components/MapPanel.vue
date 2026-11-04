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
let resizeObserver

const markers = new Map()
const DEFAULT_CENTER_DESKTOP = [25, 0]
const DEFAULT_ZOOM_DESKTOP = 2
const DEFAULT_CENTER_MOBILE = [20, 0] 
const DEFAULT_ZOOM_MOBILE = 1

function getResponsiveDefaults() {
  const isMobile = window.innerWidth < 992
  return {
    center: isMobile ? DEFAULT_CENTER_MOBILE : DEFAULT_CENTER_DESKTOP,
    zoom: isMobile ? DEFAULT_ZOOM_MOBILE : DEFAULT_ZOOM_DESKTOP,
  }
}

function resetMap() {
  if (!map) return

  const { center, zoom } = getResponsiveDefaults()

  map.flyTo(center, zoom, {
    animate: true,
    duration: 1.4,
  })

  emit('reset')
}

defineExpose({ resetMap })

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

  map.stop()

  map.setView(marker.getLatLng(), 15, {
    animate: false,
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

function handleResize() {
  if (map) {
    map.invalidateSize()
  }
}

onMounted(() => {
  const { center, zoom } = getResponsiveDefaults()

map = L.map(el.value, {
    minZoom: window.innerWidth < 992 ? 1 : 2,
    worldCopyJump: true,
    dragging: !L.Browser.mobile,
    zoomControl: !L.Browser.mobile
  }).setView(center, zoom)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(map)

  L.control.scale({
    metric: true,
    imperial: true,
    position: 'bottomleft'
  }).addTo(map)

  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 70,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    animate: false,
  })

  map.addLayer(clusterGroup)

  draw()

  if (props.selectedId != null) {
    focusSelectedUniversity()
  } else {
    resetMap()
  }

  if (window.ResizeObserver && el.value) {
    resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(el.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
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
  <div class="map-container h-100">
    <div ref="el" class="map-panel" data-testid="map-panel"></div>

    <button
      type="button"
      class="map-reset-button"
      @click="resetMap"
      aria-label="Reset map to world view"
      title="Reset Map"
    >
      <i class="bi bi-globe me-1"></i>
      Reset
    </button>
  </div>
</template>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
}

.map-panel {
  height: 100%;
  width: 100%;
  border-radius: 0;
}

:deep(.university-marker-wrapper) {
  background: transparent;
  border: none;
}

:deep(.university-marker) {
  width: 18px;
  height: 18px;
  background: var(--app-gray-blue);
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(20, 27, 77, 0.35);
  transition: all 0.2s ease;
}

:deep(.university-marker.selected) {
  width: 22px;
  height: 22px;
  background: #38bdf8;
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 3px var(--app-blue);
}

:deep(.marker-cluster) {
  background-clip: padding-box;
  border-radius: 20px;
}

:deep(.marker-cluster-small),
:deep(.marker-cluster-medium),
:deep(.marker-cluster-large) {
  background-color: rgba(20, 27, 77, 0.25);
}

:deep(.marker-cluster-small div),
:deep(.marker-cluster-medium div),
:deep(.marker-cluster-large div) {
  background-color: var(--app-blue);
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
  gap: 4px;
  padding: 6px 12px;
  background: white;
  color: var(--app-blue);
  border: 1px solid var(--app-border);
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.map-reset-button:hover {
  background: var(--app-surface);
  border-color: var(--app-gray-blue);
}

:deep(.leaflet-control-scale-line) {
  border-color: var(--app-navy);
  color: var(--app-navy);
  font-weight: 600;
  padding: 2px 6px;
}

:deep(.leaflet-bottom.leaflet-left) {
  bottom: 6px;
  left: 6px;
}
</style>
