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
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      panel.value?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
      opener?.focus?.()
    }
  },
)

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Transition name="drawer">
    <div v-if="open" class="drawer-backdrop" role="presentation" @click.self="!saving && emit('close')">
      <aside ref="panel" class="drawer-panel" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" data-testid="admin-drawer">
        <header class="d-flex align-items-center justify-content-between p-3 border-bottom">
          <h2 class="h5 mb-0">{{ title }}</h2>
          <button type="button" class="btn-close" aria-label="Close" :disabled="saving" data-testid="admin-drawer-close" @click="emit('close')"></button>
        </header>
        <div class="drawer-body p-3">
          <slot />
        </div>
        <footer class="p-3 border-top">
          <div v-if="error" class="alert alert-danger py-2" role="alert" data-testid="admin-drawer-error">{{ error }}</div>
          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-outline-secondary" :disabled="saving" data-testid="admin-drawer-cancel" @click="emit('close')">Cancel</button>
            <button type="submit" :form="formId" class="btn btn-primary" :disabled="saving" data-testid="admin-drawer-save">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ saving ? 'Saving...' : submitLabel }}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1080;
  display: flex;
  justify-content: flex-end;
  background: rgba(25, 30, 40, 0.45);
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
}

.drawer-enter-active,
.drawer-leave-active { transition: opacity 180ms ease; }
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel { transition: transform 180ms ease; }
.drawer-enter-from,
.drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel { transform: translateX(100%); }
</style>
