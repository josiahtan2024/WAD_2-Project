<script setup>
defineProps({ mappings: { type: Array, default: () => [] } })
</script>

<template>
  <div class="card border-0 shadow-sm rounded-4" data-testid="credit-mapping-table">
    <div class="card-body p-3 p-md-4">
      <h2 class="h5 fw-bold">Credit mapping</h2>
      <p v-if="!mappings.length" class="text-muted mb-0" data-testid="mapping-empty">No credit mappings recorded for this university yet.</p>
      <div v-else class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr><th>SMU module</th><th>Foreign course</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in mappings" :key="m.id" data-testid="mapping-row">
              <td>{{ m.smu_module?.code }} {{ m.smu_module?.name }}</td>
              <td>{{ m.foreign_course_code }} {{ m.foreign_course_name }}</td>
              <td class="text-muted">{{ m.notes }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table {
  width: 100%;
  table-layout: fixed;
}

.table th,
.table td {
  overflow-wrap: anywhere;
  vertical-align: top;
}

.table th:nth-child(1),
.table td:nth-child(1) {
  width: 30%;
}

.table th:nth-child(2),
.table td:nth-child(2) {
  width: 35%;
}

.table th:nth-child(3),
.table td:nth-child(3) {
  width: 35%;
}
</style>
