import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const BUCKET = 'review-images'
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Optional per-topic ratings, keyed by their column in `university_reviews`
export const REVIEW_TOPICS = [
  { key: 'academics_rating', label: 'Academics' },
  { key: 'accommodation_rating', label: 'Accommodation' },
  { key: 'cost_rating', label: 'Cost of living' },
  { key: 'campus_rating', label: 'Campus life' },
]

const REVIEW_COLUMNS = `
  id, user_id, university_id, rating, review, image_path, created_at,
  academics_rating, accommodation_rating, cost_rating, campus_rating,
  review_comments ( id, user_id, body, created_at )
`

function getUserId() {
  const user = useAuthStore().user
  if (!user) throw new Error('Please log in first.')
  return user.id
}

function explain(error) {
  if (error.code === '23505') {
    return new Error('You have already reviewed this university. Delete your review to post a new one.')
  }
  if (error.code === '42501') return new Error('You are not allowed to do that.')
  return error
}

async function uploadImage(userId, file) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Photos must be JPG, PNG or WebP.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Photos must be 2 MB or smaller.')
  const path = `${userId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

export const useReviewsStore = defineStore('reviews', {
  state: () => ({
    items: [], // rows from `university_reviews`, newest first, each with its `review_comments`
    universityId: null, // which university `items` belongs to
    loaded: false, // true once `items` has been fetched for `universityId`
    loading: false,
    saving: false,
    error: null,
  }),
  actions: {
    /** @param {number|string} universityId */
    async load(universityId) {
      const id = String(universityId)
      if (this.universityId !== id) {
        this.items = []
        this.loaded = false
      }
      this.universityId = id
      this.loading = true
      this.error = null
      try {
        const { data, error } = await supabase
          .from('university_reviews')
          .select(REVIEW_COLUMNS)
          .eq('university_id', universityId)
          .order('created_at', { ascending: false })
          .order('created_at', { referencedTable: 'review_comments', ascending: true })
        if (error) throw error
        // the user may have opened another university while this was loading
        if (this.universityId !== id) return
        this.items = data ?? []
        this.loaded = true
      } catch (error) {
        if (this.universityId === id) this.error = error.message
        throw error
      } finally {
        if (this.universityId === id) this.loading = false
      }
    },
    /**
     * Failures are thrown, not stored in `error`, so the form can show them next to the button.
     * @param {number|string} universityId
     * @param {{ rating: number, body: string, topics?: Object, image?: File|null }} draft
     */
    async post(universityId, draft) {
      if (this.saving) return
      this.saving = true
      let imagePath = null
      try {
        const userId = getUserId()
        if (draft.image) imagePath = await uploadImage(userId, draft.image)

        const row = {
          user_id: userId,
          university_id: universityId,
          rating: draft.rating,
          review: draft.body,
          image_path: imagePath,
        }
        for (const topic of REVIEW_TOPICS) row[topic.key] = draft.topics?.[topic.key] || null

        const { data, error } = await supabase
          .from('university_reviews')
          .insert(row)
          .select(REVIEW_COLUMNS)
          .single()
        if (error) throw error
        if (String(universityId) === this.universityId) this.items.unshift(data)
      } catch (error) {
        // don't leave an orphaned photo behind when the review itself was rejected
        if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath])
        throw explain(error)
      } finally {
        this.saving = false
      }
    },
    /** @param {number} reviewId Delete one of the current user's reviews. */
    async remove(reviewId) {
      const review = this.items.find((r) => r.id === reviewId)
      const { data, error } = await supabase
        .from('university_reviews')
        .delete()
        .eq('id', reviewId)
        .select('id')
      if (error) throw explain(error)
      if (!data?.length) throw new Error('Could not delete that review.')
      this.items = this.items.filter((r) => r.id !== reviewId)
      if (review?.image_path) await supabase.storage.from(BUCKET).remove([review.image_path])
    },
    /** @param {number} reviewId @param {string} body */
    async addComment(reviewId, body) {
      const userId = getUserId()
      const { data, error } = await supabase
        .from('review_comments')
        .insert({ review_id: reviewId, user_id: userId, body })
        .select('id, user_id, body, created_at')
        .single()
      if (error) throw explain(error)
      this.items.find((r) => r.id === reviewId)?.review_comments.push(data)
    },
    /** @param {number} reviewId @param {number} commentId */
    async removeComment(reviewId, commentId) {
      const { data, error } = await supabase
        .from('review_comments')
        .delete()
        .eq('id', commentId)
        .select('id')
      if (error) throw explain(error)
      if (!data?.length) throw new Error('Could not delete that comment.')
      const review = this.items.find((r) => r.id === reviewId)
      if (review) review.review_comments = review.review_comments.filter((c) => c.id !== commentId)
    },
  },
})
