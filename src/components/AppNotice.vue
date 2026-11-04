<script setup>
defineProps({
  errorMessage: { type: String, default: '' },
  successMessage: { type: String, default: '' },
})

const emit = defineEmits(['dismiss-error', 'dismiss-success'])
</script>

<template>
  <Transition name="notice">
    <div v-if="errorMessage || successMessage" class="notice-wrap" aria-live="polite">
      <!-- Error Notice -->
      <div v-if="errorMessage" class="notice notice-error card border shadow-lg" role="alert">
        <div class="card-body d-flex align-items-start gap-3 p-3">
          <div class="notice-icon notice-icon-error" aria-hidden="true">
            <i class="bi bi-exclamation-triangle-fill"></i>
          </div>
          <div class="flex-grow-1 min-w-0">
            <h2 class="h6 fw-bold text-navy mb-0.5">Error</h2>
            <p class="text-secondary small mb-0">{{ errorMessage }}</p>
            <slot name="actions" />
          </div>
          <button
            type="button"
            class="btn-close shadow-none flex-shrink-0"
            aria-label="Dismiss error message"
            @click="emit('dismiss-error')"
          ></button>
        </div>
      </div>

      <!-- Success Notice -->
      <div v-else class="notice notice-success card border shadow-lg" role="status">
        <div class="card-body d-flex align-items-start gap-3 p-3">
          <div class="notice-icon notice-icon-success" aria-hidden="true">
            <i class="bi bi-check-circle-fill"></i>
          </div>
          <div class="flex-grow-1 min-w-0">
            <h2 class="h6 fw-bold text-navy mb-0.5">Success</h2>
            <p class="text-secondary small mb-0" data-testid="notice-success-message">{{ successMessage }}</p>
            <slot name="actions" />
          </div>
          <button
            type="button"
            class="btn-close shadow-none flex-shrink-0"
            aria-label="Dismiss success message"
            data-testid="notice-dismiss-success"
            @click="emit('dismiss-success')"
          ></button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.notice-wrap {
  position: fixed;
  top: calc(var(--app-navbar-height) + 0.75rem);
  left: 50%;
  transform: translateX(-50%);
  width: min(38rem, calc(100vw - 2rem));
  z-index: 1085;
  pointer-events: none;
}

.notice {
  pointer-events: auto;
  border-radius: 1rem;
  overflow: hidden;
  border-color: var(--app-border, #e8eaf0) !important;
  animation: notice-enter 180ms ease-out;
}

.notice .card-body {
  background: #fff;
}

.notice-error {
  border-left: 4px solid #dc3545 !important;
}

.notice-success {
  border-left: 4px solid #198754 !important;
}

.notice-icon {
  width: 2rem;
  height: 2rem;
  flex: 0 0 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 1rem;
}

.notice-icon-error {
  background: #fce8ea;
  color: #dc3545;
}

.notice-icon-success {
  background: #dff4e7;
  color: #198754;
}

.notice-enter-active,
.notice-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}

@media (max-width: 991.98px) {
  .notice-wrap {
    top: auto;
    bottom: 1rem;
  }
}

@keyframes notice-enter {
  from {
    opacity: 0;
    transform: translateY(-0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>