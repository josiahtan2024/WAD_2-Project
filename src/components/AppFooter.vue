<template>
  <footer class="app-footer mt-5">
    <div class="container-xl py-4 py-md-5">
      <div class="row g-4 align-items-start pb-4">
        <div class="col-12 col-lg-7">
          <RouterLink class="footer-brand d-inline-flex align-items-center gap-2 mb-2" :to="{ name: 'home' }">
            <span class="footer-brand-mark"><i class="bi bi-compass-fill" aria-hidden="true"></i></span>
            <span>SMUXchange</span>
          </RouterLink>
          <p class="footer-description mb-0">
            Explore your exchange options and bring your university, course, schedule, and budget plans together.
          </p>
        </div>
        <div class="col-12 col-lg-5">
          <nav class="d-flex flex-column flex-sm-row justify-content-lg-end gap-3 gap-sm-4 footer-links" aria-label="Footer navigation">
            <RouterLink :to="{ name: 'universities' }">Universities</RouterLink>
            <RouterLink :to="{ name: 'courses' }">Course Search</RouterLink>
            <RouterLink :to="{ name: 'about' }">About Us</RouterLink>
          </nav>
        </div>
      </div>
      <div class="footer-bottom pt-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <small>&copy; 2026 SMUXchange. All rights reserved.</small>
        <small>Made for your next chapter abroad <i class="bi bi-globe-asia-australia ms-1" aria-hidden="true"></i></small>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  color: #e5e7eb;
  background: linear-gradient(120deg, #141b4d, #2c3366);
}

.footer-brand {
  color: #ffffff;
  font-size: 1.15rem;
  font-weight: 700;
  text-decoration: none;
}

.footer-brand:hover {
  color: #a4a9cf;
}

.footer-brand-mark {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.65rem;
  color: #141b4d;
  background: #ffffff;
}

.footer-description {
  max-width: 34rem;
  color: #c5c9e2;
  line-height: 1.6;
}

.footer-links a {
  color: #e5e7eb;
  font-size: 0.92rem;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s ease;
}

.footer-links a:hover,
.footer-links a.router-link-active {
  color: #ffffff;
}

.footer-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  color: #a4a9cf;
}

@media (max-width: 575.98px) {
  .footer-links {
    flex-direction: row !important;
    flex-wrap: wrap;
    column-gap: 1rem !important;
    row-gap: 0.65rem !important;
  }
}
</style>
