import { defineStore } from 'pinia'
import { STORAGE_URL, supabase } from '@/lib/supabase'
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
  id, user_id, university_id, rating, review, image_path, created_at, updated_at,
  academics_rating, accommodation_rating, cost_rating, campus_rating,
  review_comments ( id, user_id, body, created_at )
`

export function reviewImageUrl(path) {
  return `${STORAGE_URL}/${BUCKET}/${path}`
}

function getUserId() {
  const user = useAuthStore().user
  if (!user) throw new Error('Please log in first.')
  return user.id
}

function explain(error) {
  if (error.code === '23505') {
    return new Error('You have already reviewed this university. Edit or delete your review instead.')
  }
  if (error.code === '42501') return new Error('You are not allowed to do that.')
  // .single() finds no row when the review is gone or belongs to someone else
  if (error.code === 'PGRST116') return new Error('That review no longer exists.')
  return error
}

// the columns that make up a review, shared by post() and update()
function reviewFields(draft) {
  const fields = { rating: draft.rating, review: draft.body }
  for (const topic of REVIEW_TOPICS) fields[topic.key] = draft.topics?.[topic.key] || null
  return fields
}

async function uploadImage(userId, file) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Photos must be JPG, PNG or WebP.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Photos must be 2 MB or smaller.')
  const path = `${userId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

// Best effort: a photo that can't be removed is not worth failing the whole action for.
async function deleteImage(path) {
  if (path) await supabase.storage.from(BUCKET).remove([path])
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
  getters: {
    // the store can still hold the previous university's reviews until the next load starts
    isLoadedFor: (state) => (universityId) => state.loaded && state.universityId === String(universityId),
    reviewOf: (state) => (userId) => state.items.find((r) => r.user_id === userId),
  },
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
          .eq('university_id', id)
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
        const { data, error } = await supabase
          .from('university_reviews')
          .insert({ ...reviewFields(draft), user_id: userId, university_id: universityId, image_path: imagePath })
          .select(REVIEW_COLUMNS)
          .single()
        if (error) throw error
        if (String(universityId) === this.universityId) this.items.unshift(data)
      } catch (error) {
        // don't leave an orphaned photo behind when the review itself was rejected
        await deleteImage(imagePath)
        throw explain(error)
      } finally {
        this.saving = false
      }
    },
    /**
     * Edit one of the current user's reviews. The photo is kept unless a new one is
     * picked or `removeImage` is set.
     * @param {number} reviewId
     * @param {{ rating: number, body: string, topics?: Object, image?: File|null, removeImage?: boolean }} draft
     */
    async update(reviewId, draft) {
      if (this.saving) return
      this.saving = true
      const before = this.items.find((r) => r.id === reviewId)
      let newPath = null
      let saved
      try {
        const userId = getUserId()
        if (draft.image) newPath = await uploadImage(userId, draft.image)

        const changes = { ...reviewFields(draft), updated_at: new Date().toISOString() }
        if (newPath) changes.image_path = newPath
        else if (draft.removeImage) changes.image_path = null

        const { data, error } = await supabase
          .from('university_reviews')
          .update(changes)
          .eq('id', reviewId)
          .select(REVIEW_COLUMNS)
          .single()
        if (error) throw error
        saved = data
      } catch (error) {
        await deleteImage(newPath)
        throw explain(error)
      } finally {
        this.saving = false
      }

      // keep the comments we already have, they may have changed while the form was open
      const index = this.items.findIndex((r) => r.id === reviewId)
      if (index !== -1) this.items[index] = { ...saved, review_comments: this.items[index].review_comments }
      // only drop the old photo once the new row is safely saved
      if (before?.image_path && before.image_path !== saved.image_path) await deleteImage(before.image_path)
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
      await deleteImage(review?.image_path)
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
