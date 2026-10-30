<script setup>
import { computed, reactive, ref } from 'vue'
import { STORAGE_URL } from '@/lib/supabase'

const props = defineProps({ university: { type: Object, required: true } })
const emit = defineEmits(['submit'])

const form = reactive({
  name: props.university.name ?? '',
  website_url: props.university.website_url ?? '',
  description: props.university.description ?? '',
})
const logo = ref(null)
const errors = ref({})

const currentLogo = computed(() => {
  const path = props.university.logo_url
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${STORAGE_URL}/university-logos/${path.replace(/^\/?university-logos\//, '')}`
})

function isWebAddress(text) {
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol)
  } catch {
    return false
  }
}

function pickLogo(event) {
  logo.value = event.target.files[0] ?? null
}

function submit() {
  const found = {}
  if (!form.name.trim()) found.name = 'Enter the university name.'
  const website = form.website_url.trim()
  if (website && !isWebAddress(website)) found.website_url = 'Enter a full web address, for example https://www.example.edu.'
  errors.value = found
  if (Object.keys(found).length) return

  emit('submit', {
    fields: { name: form.name.trim(), website_url: website || null, description: form.description.trim() || null },
    logo: logo.value,
  })
}
</script>

<template>
  <form id="admin-form" novalidate @submit.prevent="submit">
    <div class="mb-3">
      <label class="form-label" for="det-name">University name</label>
      <input id="det-name" v-model="form.name" class="form-control" :class="{ 'is-invalid': errors.name }" data-testid="admin-field-name" />
      <div v-if="errors.name" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.name }}</div>
    </div>
    <div class="mb-3">
      <label class="form-label" for="det-website">Website</label>
      <input id="det-website" v-model="form.website_url" class="form-control" type="url" placeholder="https://" :class="{ 'is-invalid': errors.website_url }" data-testid="admin-field-website" />
      <div v-if="errors.website_url" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.website_url }}</div>
    </div>
    <div class="mb-3">
      <label class="form-label" for="det-description">Description</label>
      <textarea id="det-description" v-model="form.description" class="form-control" rows="4" data-testid="admin-field-description"></textarea>
    </div>
    <div class="mb-3">
      <label class="form-label" for="det-logo">{{ currentLogo ? 'Replace logo' : 'Logo' }}</label>
      <img v-if="currentLogo" :src="currentLogo" :alt="`${university.name} logo`" class="img-thumbnail d-block mb-2" style="max-height: 6rem" />
      <input id="det-logo" type="file" accept="image/jpeg,image/png,image/webp" class="form-control" data-testid="admin-field-logo" @change="pickLogo" />
      <div class="form-text">JPG, PNG or WebP, up to 2 MB.</div>
    </div>
  </form>
</template>
