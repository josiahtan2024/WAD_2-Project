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
  addLanguage() // a language that was typed but not added yet should not be lost
  const url = form.modules_url.trim()
  errors.value = url && !isWebAddress(url) ? { modules_url: 'Enter a full web address, for example https://www.example.edu/courses.' } : {}
  if (Object.keys(errors.value).length) return
  emit('submit', { languages: form.languages, modules_url: url || null })
}
</script>

<template>
  <form id="admin-form" novalidate @submit.prevent="submit">
    <label class="form-label" for="acad-language">Languages of instruction</label>
    <div class="input-group mb-2">
      <input id="acad-language" v-model="newLanguage" class="form-control" placeholder="English" data-testid="admin-field-language" @keydown.enter.prevent="addLanguage" />
      <button type="button" class="btn btn-outline-primary" data-testid="admin-add-language" @click="addLanguage">Add</button>
    </div>
    <div class="d-flex flex-wrap gap-2 mb-3" data-testid="admin-language-list">
      <span v-for="l in form.languages" :key="l" class="badge text-bg-light border d-inline-flex align-items-center gap-2 fs-6 fw-normal">
        {{ l }}
        <button type="button" class="btn-close btn-sm" :aria-label="`Remove ${l}`" data-testid="admin-remove-language" @click="removeLanguage(l)"></button>
      </span>
      <span v-if="!form.languages.length" class="text-secondary small">No languages yet.</span>
    </div>

    <label class="form-label" for="acad-modules-url">Course catalogue link</label>
    <input id="acad-modules-url" v-model="form.modules_url" class="form-control" type="url" placeholder="https://" :class="{ 'is-invalid': errors.modules_url }" data-testid="admin-field-modules-url" />
    <div v-if="errors.modules_url" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.modules_url }}</div>
  </form>
</template>
