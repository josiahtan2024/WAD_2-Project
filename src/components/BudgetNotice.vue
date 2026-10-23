<script setup>
defineProps({
  errorMessage: { type: String, default: '' },
  successMessage: { type: String, default: '' },
})

const emit = defineEmits(['dismiss-error', 'dismiss-success'])
</script>

<template>
  <Transition name="notice">
    <div
      v-if="errorMessage || successMessage"
      class="budget-notice-wrap"
      aria-live="polite"
    >
      <div
        v-if="errorMessage"
        class="budget-notice budget-notice-error card border-0 shadow-lg"
        role="alert"
      >
        <div class="card-body d-flex align-items-start gap-3 p-3 p-md-4">
          <div class="notice-icon notice-icon-error" aria-hidden="true">!</div>
          <div class="flex-grow-1">
            <h2 class="h6 fw-bold mb-1">Something went wrong</h2>
            <p class="mb-0">{{ errorMessage }}</p>
          </div>
          <button type="button" class="btn-close" aria-label="Dismiss error message" @click="emit('dismiss-error')"></button>
        </div>
      </div>

      <div
        v-else
        class="budget-notice budget-notice-success card border-0 shadow-lg"
        role="status"
      >
        <div class="card-body d-flex align-items-start gap-3 p-3 p-md-4">
          <div class="notice-icon notice-icon-success" aria-hidden="true">✓</div>
          <div class="flex-grow-1">
            <h2 class="h6 fw-bold mb-1">Successfully completed</h2>
            <p class="mb-0">{{ successMessage }}</p>
          </div>
          <button type="button" class="btn-close" aria-label="Dismiss success message" @click="emit('dismiss-success')"></button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.budget-notice-wrap {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  width: min(42rem, calc(100vw - 2rem));
  z-index: 1085;
  pointer-events: none;
}

.budget-notice {
  pointer-events: auto;
  border-radius: 1rem;
  overflow: hidden;
  animation: notice-enter 180ms ease-out;
}

.budget-notice .card-body { background: #fff; }
.budget-notice-error { border-left: 5px solid #dc3545 !important; }
.budget-notice-success { border-left: 5px solid #198754 !important; }

.notice-icon {
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 1.2rem;
  font-weight: 800;
}

.notice-icon-error { background: #fce8ea; color: #b02a37; }
.notice-icon-success { background: #dff4e7; color: #146c43; }

.notice-enter-active,
.notice-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.notice-enter-from,
.notice-leave-to { opacity: 0; transform: translateY(-0.5rem); }

@keyframes notice-enter {
  from { opacity: 0; transform: translateY(-0.5rem); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
