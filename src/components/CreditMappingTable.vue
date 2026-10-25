<script setup>
defineProps({ mappings: { type: Array, default: () => [] } })
</script>

<template>
  <div class="card card-body" data-testid="credit-mapping-table">
    <h2 class="h5">Credit mapping</h2>
    <p v-if="!mappings.length" class="text-muted mb-0" data-testid="mapping-empty">No credit mappings recorded for this university yet.</p>
    <div v-else class="table-responsive">
      <table class="table align-middle mb-0">
        <thead>
          <tr><th>SMU course area</th><th>Foreign course</th><th>Notes</th></tr>
        </thead>
        <tbody>
          <tr v-for="m in mappings" :key="m.id" data-testid="mapping-row">
            <td>
              <span class="fw-semibold">{{ m.smu_module?.course_area }}</span>
              <div class="small text-muted">{{ m.smu_module?.description }}</div>
            </td>
            <td>{{ m.university_module?.module_name }}</td>
            <td class="text-muted">{{ m.notes }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
