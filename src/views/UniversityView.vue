<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUniversitiesStore } from '@/stores/universities'
import { useReviewsStore } from '@/stores/reviews'
import { useAuthStore } from '@/stores/auth'
import CreditMappingTable from '@/components/CreditMappingTable.vue'
import ReviewCarousel from '@/components/ReviewCarousel.vue'
import ReviewForm from '@/components/ReviewForm.vue'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const logoUrl = computed(() => {
  const path = university.value?.logo_url
  if (!path) return ''

  if (/^https?:\/\//i.test(path)) return path

  const filePath = path.replace(/^\/?university-logos\//, '')

  return supabase.storage
    .from('university-logos')
    .getPublicUrl(filePath).data.publicUrl
})

const route = useRoute()
const uni = useUniversitiesStore()
const reviews = useReviewsStore()
const auth = useAuthStore()
const posting = ref(false)
const postError = ref('')

const university = computed(() => uni.items.find((u) => String(u.id) === route.params.id))

async function post(body, done) {
  posting.value = true
  postError.value = ''
  try {
    await reviews.post(route.params.id, body)
    await reviews.load(route.params.id)
    done()
  } catch (e) {
    postError.value = e.message
  } finally {
    posting.value = false
  }
}

onMounted(async () => {
  try {
    if (!uni.items.length) await uni.load()
    // await uni.loadMappings(route.params.id)
  } catch (e) {
    uni.error = e.message
  }

  // try {
  //   await reviews.load(route.params.id)
  // } catch (e) {
  //   reviews.error = e.message
  // }
})
</script>

<template>
  <section data-testid="university-page">
    <div v-if="uni.loading" class="text-muted" data-testid="university-loading">Loading...</div>
    <div v-else-if="uni.error" class="alert alert-danger" data-testid="university-error">{{ uni.error }}</div>
    <p v-else-if="!university" class="text-muted" data-testid="university-not-found">University not found. <RouterLink to="/universities">Back to list</RouterLink></p>
    <template v-else>
      <div class="d-flex align-items-center gap-3 mb-4">


        <div>
          <h1 class="h3 mb-2">{{ university.name }}</h1>
          <p class="text-muted mb-0">
            {{ university.city }}, {{ university.country }}
          </p>
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="`${university.name} logo`"
            class="detail-logo rounded-3"/>
        </div>
      </div>
      <div class="row g-3">
        <div class="col-12 col-lg-6"><CostEstimator :university="university" /></div>
        <div class="col-12 col-lg-6"><CreditMappingTable :mappings="uni.mappings" /></div>
        <div class="col-12">
          <div v-if="reviews.error" class="alert alert-warning" data-testid="reviews-error">{{ reviews.error }}</div>
          <ReviewCarousel :reviews="reviews.items" />
          <div v-if="postError" class="alert alert-danger mt-2" data-testid="review-post-error">{{ postError }}</div>
          <ReviewForm :logged-in="!!auth.user" :submitting="posting" @submit="post" />
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.detail-logo {
  width: 200px;
  height: 200px;
  max-width: 100%;
  object-fit: contain;
  background-color: white;
}
</style>