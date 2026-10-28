<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  confirmLabel: { type: String, default: 'Confirm' },
  danger: { type: Boolean, default: false },
  working: { type: Boolean, default: false },
  error: { type: String, default: '' },
  // when set, the confirm button stays disabled until this exact text is typed
  typeToConfirm: { type: String, default: '' },
})
const emit = defineEmits(['cancel', 'confirm'])

const typed = ref('')
const allowed = computed(() => !props.typeToConfirm || typed.value.trim() === props.typeToConfirm)

watch(() => props.open, () => (typed.value = ''))
</script>

<template>
  <Transition name="confirm">
    <div v-if="open" class="confirm-backdrop" role="presentation" @click.self="!working && emit('cancel')">
      <section class="confirm-card card border-0 shadow-lg" :class="{ 'is-danger': danger }" role="alertdialog" aria-modal="true" :aria-label="title" data-testid="confirm-dialog">
        <div class="card-body p-4">
          <h2 class="h5 fw-bold mb-2">{{ title }}</h2>
          <div class="text-secondary"><slot /></div>
          <div v-if="typeToConfirm" class="mt-3">
            <label class="form-label small" for="confirm-typed">Type <strong>{{ typeToConfirm }}</strong> to confirm</label>
            <input id="confirm-typed" v-model="typed" class="form-control" autocomplete="off" data-testid="confirm-typed-input" />
          </div>
          <div v-if="error" class="alert alert-danger py-2 mt-3 mb-0" role="alert" data-testid="confirm-error">{{ error }}</div>
          <div class="d-flex flex-column-reverse flex-sm-row justify-content-end gap-2 mt-4">
            <button type="button" class="btn btn-outline-secondary" :disabled="working" data-testid="confirm-cancel" @click="emit('cancel')">Cancel</button>
            <button type="button" class="btn" :class="danger ? 'btn-danger' : 'btn-primary'" :disabled="working || !allowed" data-testid="confirm-ok" @click="emit('confirm')">
              <span v-if="working" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1090;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(25, 30, 40, 0.45);
}

.confirm-card {
  width: min(100%, 31rem);
  border-radius: 1rem;
  overflow: hidden;
  border-top: 5px solid var(--bs-primary) !important;
}

.confirm-card.is-danger { border-top-color: #dc3545 !important; }

.confirm-enter-active,
.confirm-leave-active { transition: opacity 180ms ease; }
.confirm-enter-from,
.confirm-leave-to { opacity: 0; }
</style>
