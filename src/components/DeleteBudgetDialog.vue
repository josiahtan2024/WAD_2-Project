<script setup>
defineProps({
  budget: { type: Object, default: null },
  deleting: { type: Boolean, default: false },
})

const emit = defineEmits(['cancel', 'confirm'])
</script>

<template>
  <Transition name="delete-modal">
    <div
      v-if="budget"
      class="delete-confirm-backdrop"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <section
        class="delete-confirm-card card border-0 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
      >
        <div class="card-body p-4">
          <div class="d-flex align-items-start gap-3 mb-3">
            <div class="notice-icon notice-icon-error" aria-hidden="true">!</div>
            <div class="flex-grow-1">
              <h2 id="delete-confirm-title" class="h5 fw-bold mb-1">Delete this budget?</h2>
              <p id="delete-confirm-description" class="text-secondary mb-0">
                Are you sure you want to delete the budget for
                <strong>{{ budget.university_name }}</strong>?
                This action cannot be undone.
              </p>
            </div>
            <button type="button" class="btn-close" aria-label="Cancel deletion" :disabled="deleting" @click="emit('cancel')"></button>
          </div>
          <div class="d-flex flex-column-reverse flex-sm-row justify-content-end gap-2 mt-4">
            <button type="button" class="btn btn-outline-secondary" :disabled="deleting" @click="emit('cancel')">Cancel</button>
            <button type="button" class="btn btn-danger" :disabled="deleting" @click="emit('confirm')">
              <span v-if="deleting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ deleting ? 'Deleting…' : 'Delete Budget' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
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
.delete-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1090;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(25, 30, 40, 0.45);
  backdrop-filter: blur(2px);
}

.delete-confirm-card {
  width: min(100%, 31rem);
  border-radius: 1rem;
  overflow: hidden;
  border-top: 5px solid #dc3545 !important;
  transition: transform 180ms ease;
}

.delete-modal-enter-active,
.delete-modal-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.delete-modal-enter-from,
.delete-modal-leave-to { opacity: 0; }
.delete-modal-enter-from .delete-confirm-card,
.delete-modal-leave-to .delete-confirm-card { transform: translateY(0.5rem) scale(0.98); }
</style>
