<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' },
  submitLabel: { type: String, default: 'Save' },
  formId: { type: String, default: 'admin-form' },
})
const emit = defineEmits(['close'])

const panel = ref(null)
let opener = null

function onKeydown(event) {
  if (event.key === 'Escape' && !props.saving) emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      opener = document.activeElement
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      panel.value?.focus()
    } else {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeydown)
      opener?.focus?.()
    }
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Transition name="drawer">
    <div v-if="open" class="drawer-backdrop" role="presentation">
      <aside
        ref="panel"
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
        data-testid="admin-drawer"
      >
        <header class="d-flex align-items-center justify-content-between p-3.5 px-4 border-bottom bg-surface">
          <h2 class="h6 fw-bold text-navy mb-0">{{ title }}</h2>
          <button
            type="button"
            class="btn-close shadow-none"
            aria-label="Close drawer"
            :disabled="saving"
            data-testid="admin-drawer-close"
            @click="emit('close')"
          ></button>
        </header>

        <div class="drawer-body p-4">
          <slot />
        </div>

        <footer class="p-3.5 px-4 border-top bg-surface">
          <div v-if="error" class="alert alert-danger py-2 small rounded-3 mb-3" role="alert" data-testid="admin-drawer-error">
            {{ error }}
          </div>
          <div class="d-flex justify-content-end gap-2">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1.5"
              :disabled="saving"
              data-testid="admin-drawer-cancel"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="submit"
              :form="formId"
              class="btn btn-primary btn-sm rounded-pill px-4 py-1.5"
              :disabled="saving"
              data-testid="admin-drawer-save"
            >
              <span v-if="saving" class="spinner-border spinner-border-sm me-1.5" aria-hidden="true"></span>
              {{ saving ? 'Saving...' : submitLabel }}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.bg-surface {
  background-color: var(--app-surface, #f8f9fc);
}

.p-3\.5 {
  padding: 0.875rem 1rem;
}

.me-1\.5 {
  margin-right: 0.375rem;
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1080;
  display: flex;
  justify-content: flex-end;
  background: rgba(25, 30, 40, 0.45);
  backdrop-filter: blur(2px);
}

.drawer-panel {
  display: flex;
  flex-direction: column;
  width: min(100%, 30rem);
  height: 100%;
  background: #fff;
  box-shadow: -0.5rem 0 1.5rem rgba(0, 0, 0, 0.15);
  outline: none;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 180ms ease;
}
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 180ms ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>