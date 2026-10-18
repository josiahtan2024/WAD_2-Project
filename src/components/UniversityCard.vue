<script setup>
import { supabase } from '@/lib/supabase'

function getLogoUrl(path) {
  const filePath = path.replace(/^university-logos\//, '')

  return supabase.storage
    .from('university-logos')
    .getPublicUrl(filePath).data.publicUrl
}
import { ref } from 'vue'
const isHovered = ref(false)

defineProps({
  university: { type: Object, required: true },
  shortlisted: { type: Boolean, default: false },
  selectedRegion: { type: String, default: null },
})
defineEmits(['toggle-shortlist'])
</script>

<style scoped>
.university-card {
  outline: 2px solid transparent;
  outline-offset: 0;
  transition: outline-color 0.15s ease;
}

.university-card.is-hovered {
  outline-color: var(--bs-primary);
}

.university-name{
  font-weight:800;
  color: #01125f;
}
.university-info {
  min-width: 0;
  overflow-wrap: anywhere;
}

.university-logo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.university-logo-box {
  width: 88px;
  aspect-ratio: 1 / 1;
  align-self: flex-start;
}

@media (max-width: 575.98px) {
  .university-logo {
    width: 40px;
    height: 40px;
  }
}

.university-region {
  color: #adb5bd;
  font-weight: 400;
}

.university-region.is-filtered {
  color: #000;
  font-weight: 700;
}
</style>

<template>
  <div
    class="card h-100 shadow-sm university-card"
    :class="{ 'is-hovered': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    data-testid="university-card"
  >
    <div class="card-body d-flex flex-column">
      <div class="d-flex align-items-stretch gap-3 mb-3">
        <div
          v-if="university.logo_url"
          class="university-logo-box position-relative flex-shrink-0 rounded-3 overflow-hidden bg-white"
        >
          <img
            :src="getLogoUrl(university.logo_url)"
            :alt="`${university.name} logo`"
            class="university-logo"
            loading="lazy"
          />
        </div>

        <div class="university-info flex-grow-1">
          <h2
            class="h5 card-title university-name mb-2"
            data-testid="university-card-name"
          >
            {{ university.name }}
          </h2>

          <p class="card-text text-muted mb-0">
            {{ university.city }}, {{ university.country }}
          </p>

          <p class="small text-muted mb-0">
            Estimated cost:
            {{ university.region_band_min == null
              ? 'Not available'
              : `SGD ${Number(university.region_band_min).toLocaleString()}` }}
          </p>
        </div>
      </div>

<div class="mt-auto d-flex align-items-end gap-2">
  <div class="d-flex flex-wrap gap-2">
    <RouterLink
      :to="`/universities/${university.id}`"
      class="btn btn-outline-primary btn-sm"
      data-testid="university-card-link"
    >
      Details
    </RouterLink>

    <button
      class="btn btn-sm"
      :class="shortlisted ? 'btn-secondary' : 'btn-primary'"
      :data-testid="shortlisted ? 'shortlist-remove-btn' : 'shortlist-add-btn'"
      @click="$emit('toggle-shortlist', university)"
    >
      {{ shortlisted ? 'Remove from shortlist' : 'Add to shortlist' }}
    </button>
  </div>
  <span class="university-region ms-auto flex-shrink-0 small"
  v-bind:class="{
    'is-filtered':selectedRegion === university.region}">
    {{ university.region }}
  </span>
    </div>
  </div>
</div>
</template>
