<script setup>
// Styled after a product comparison page: one column per university, one row per attribute.
defineProps({ universities: { type: Array, default: () => [] } })
defineEmits(['remove'])

const rows = [
  { label: 'Country', get: (u) => u.country },
  { label: 'City', get: (u) => u.city },
  { label: 'Region', get: (u) => u.region },
  { label: 'Currency', get: (u) => u.currency_code },
  { label: 'SMU cost band (SGD)', get: (u) => `${u.region_band_min?.toLocaleString()} to ${u.region_band_max?.toLocaleString()}` },
]
</script>

<template>
  <div class="table-responsive compare-wrap" data-testid="compare-table">
    <table class="table compare-table text-center align-middle">
      <thead>
        <tr>
          <th class="text-start"></th>
          <th v-for="u in universities" :key="u.id" class="pb-4" data-testid="compare-col">
            <div class="h5 mb-2">{{ u.name }}</div>
            <RouterLink :to="`/universities/${u.id}`" class="btn btn-primary btn-sm me-1">Details</RouterLink>
            <button class="btn btn-outline-secondary btn-sm" data-testid="compare-remove-btn" @click="$emit('remove', u)">Remove</button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.label">
          <th scope="row" class="text-start text-muted fw-normal">{{ row.label }}</th>
          <td v-for="u in universities" :key="u.id">{{ row.get(u) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.compare-table { min-width: 560px; }
.compare-table td, .compare-table th { padding: 1rem; }
.compare-table tbody tr { border-top: 1px solid #dee2e6; }
</style>
