<script setup>
defineProps({ reviews: { type: Array, default: () => [] } })
</script>

<template>
  <div data-testid="review-carousel">
    <h2 class="h5">Reviews</h2>
    <p v-if="!reviews.length" class="text-muted" data-testid="reviews-empty">No reviews yet. Be the first to post one.</p>
    <div v-else id="review-carousel" class="carousel slide card card-body" data-bs-interval="false">
      <div class="carousel-inner px-4">
        <div v-for="(r, i) in reviews" :key="r.id" class="carousel-item" :class="{ active: i === 0 }" data-testid="review-item">
          <blockquote class="mb-1">{{ r.body }}</blockquote>
          <small class="text-muted">{{ new Date(r.created_at).toLocaleDateString() }}</small>
        </div>
      </div>
      <button class="carousel-control-prev" type="button" data-bs-target="#review-carousel" data-bs-slide="prev" aria-label="Previous review" data-testid="review-prev-btn">
        <span class="carousel-control-prev-icon bg-dark rounded-circle p-2" aria-hidden="true"></span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#review-carousel" data-bs-slide="next" aria-label="Next review" data-testid="review-next-btn">
        <span class="carousel-control-next-icon bg-dark rounded-circle p-2" aria-hidden="true"></span>
      </button>
    </div>
  </div>
</template>
