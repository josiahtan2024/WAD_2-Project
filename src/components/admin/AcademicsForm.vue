<script setup>
import { reactive, ref } from 'vue'

const props = defineProps({
  languages: { type: Array, default: () => [] },
  modulesUrl: { type: String, default: '' },
})
const emit = defineEmits(['submit'])

const form = reactive({ languages: [...props.languages], modules_url: props.modulesUrl ?? '' })
const newLanguage = ref('')
const errors = ref({})

function addLanguage() {
  const name = newLanguage.value.trim()
  if (!name) return
  if (!form.languages.some((l) => l.toLowerCase() === name.toLowerCase())) form.languages.push(name)
  newLanguage.value = ''
}

function removeLanguage(name) {
  form.languages = form.languages.filter((l) => l !== name)
}

function isWebAddress(text) {
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol)
  } catch {
    return false
  }
}

function submit() {
  addLanguage()
  const url = form.modules_url.trim()
  errors.value = url && !isWebAddress(url) ? { modules_url: 'Enter a valid URL (e.g. https://www.example.edu/courses).' } : {}
  if (Object.keys(errors.value).length) return
  emit('submit', { languages: form.languages, modules_url: url || null })
}
</script>

<template>
  <form id="admin-form" class="d-flex flex-column gap-3" novalidate @submit.prevent="submit">
    <div>
      <label class="form-label fw-semibold text-navy small mb-1" for="acad-language">Language of Instruction</label>
      <div class="input-group mb-2">
        <input
          id="acad-language"
          v-model="newLanguage"
          class="form-control shadow-none"
          placeholder="e.g. English, Japanese"
          data-testid="admin-field-language"
          @keydown.enter.prevent="addLanguage"
        />
        <button type="button" class="btn btn-outline-primary px-3" data-testid="admin-add-language" @click="addLanguage">
          Add
        </button>
      </div>
      <div class="d-flex flex-wrap gap-1.5" data-testid="admin-language-list">
        <span
          v-for="l in form.languages"
          :key="l"
          class="badge bg-white text-navy border fw-medium rounded-pill d-inline-flex align-items-center gap-1.5 px-3 py-1.5 fs-7"
        >
          {{ l }}
          <button
            type="button"
            class="btn-close btn-close-sm ms-1"
            :aria-label="`Remove ${l}`"
            data-testid="admin-remove-language"
            @click="removeLanguage(l)"
          ></button>
        </span>
        <span v-if="!form.languages.length" class="text-muted small italic">No languages added yet.</span>
      </div>
    </div>

    <div>
      <label class="form-label fw-semibold text-navy small mb-1" for="acad-modules-url">Course Catalogue Link</label>
      <input
        id="acad-modules-url"
        v-model="form.modules_url"
        class="form-control shadow-none"
        type="url"
        placeholder="https://"
        :class="{ 'is-invalid': errors.modules_url }"
        data-testid="admin-field-modules-url"
      />
      <div v-if="errors.modules_url" class="invalid-feedback d-block" data-testid="admin-field-error">
        {{ errors.modules_url }}
      </div>
    </div>
  </form>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.fs-7 {
  font-size: 0.8125rem;
}

.gap-1\.5 {
  gap: 0.375rem;
}
</style>