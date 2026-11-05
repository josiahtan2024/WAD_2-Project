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
  if (website && !isWebAddress(website)) found.website_url = 'Enter a valid URL (e.g. https://www.example.edu).'
  errors.value = found
  if (Object.keys(found).length) return

  emit('submit', {
    fields: { name: form.name.trim(), website_url: website || null, description: form.description.trim() || null },
    logo: logo.value,
  })
}
</script>

<template>
  <form id="admin-form" class="d-flex flex-column gap-3" novalidate @submit.prevent="submit">
    <div>
      <label class="form-label fw-semibold text-navy small mb-1" for="det-name">University Name</label>
      <input id="det-name" v-model="form.name" class="form-control shadow-none" :class="{ 'is-invalid': errors.name }" data-testid="admin-field-name" />
      <div v-if="errors.name" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.name }}</div>
    </div>

    <div>
      <label class="form-label fw-semibold text-navy small mb-1" for="det-website">Website URL</label>
      <input id="det-website" v-model="form.website_url" class="form-control shadow-none" type="url" placeholder="https://" :class="{ 'is-invalid': errors.website_url }" data-testid="admin-field-website" />
      <div v-if="errors.website_url" class="invalid-feedback d-block" data-testid="admin-field-error">{{ errors.website_url }}</div>
    </div>

    <div>
      <label class="form-label fw-semibold text-navy small mb-1" for="det-description">Overview & Description</label>
      <textarea id="det-description" v-model="form.description" class="form-control shadow-none" rows="4" data-testid="admin-field-description"></textarea>
    </div>

    <div>
      <label class="form-label fw-semibold text-navy small mb-1" for="det-logo">{{ currentLogo ? 'Replace Logo' : 'University Logo' }}</label>
      <div v-if="currentLogo" class="p-2 border rounded-3 bg-surface mb-2 d-inline-block">
        <img :src="currentLogo" :alt="`${university.name} logo`" class="img-fluid rounded" style="max-height: 4.5rem; object-fit: contain;" />
      </div>
      <input id="det-logo" type="file" accept="image/jpeg,image/png,image/webp" class="form-control shadow-none" data-testid="admin-field-logo" @change="pickLogo" />
      <div class="form-text small text-muted mt-1">Accepts JPG, PNG or WebP up to 2 MB.</div>
    </div>
  </form>
</template>

<style scoped>
.text-navy {
  color: var(--app-navy);
}

.bg-surface {
  background-color: var(--app-surface, #f8f9fc);
}
</style>