<template>
  <section class="about-page container py-4 mb-5" data-testid="about-page">
    <header class="about-hero rounded-4 p-4 p-md-5 mb-5">
      <div class="row align-items-center g-4 g-xl-5">
        <div class="col-12 col-lg-7">
          <p class="text-uppercase fw-bold small mb-3 about-eyebrow">
            <span class="about-eyebrow-mark"></span> About SMUXchange
          </p>
          <h1 class="page-title display-5 fw-bold mb-3">
            Your next chapter starts with a good plan.
          </h1>
          <p class="lead mb-4 about-intro">
            SMUXchange brings exchange research and planning tools together, helping SMU students
            explore destinations, compare options, and prepare for their exchange journey.
          </p>
          <RouterLink class="btn btn-light btn-lg about-hero-cta" :to="{ name: 'universities' }">
            Explore universities <i class="bi bi-arrow-right ms-2" aria-hidden="true"></i>
          </RouterLink>
        </div>
        <div class="col-12 col-lg-5">
          <div
            class="about-journey-card rounded-4 p-3 p-md-4"
            aria-label="Your exchange planning journey"
          >
            <div class="d-flex justify-content-between align-items-center mb-4">
              <span class="small fw-bold">Your exchange journey</span>
              <i class="bi bi-globe-americas journey-globe" aria-hidden="true"></i>
            </div>
            <div class="journey-item">
              <span class="journey-icon"><i class="bi bi-compass" aria-hidden="true"></i></span>
              <div>
                <span class="journey-label">Explore</span
                ><span class="journey-caption">Discover destinations</span>
              </div>
              <i class="bi bi-check-circle-fill journey-check" aria-hidden="true"></i>
            </div>
            <div class="journey-connector"></div>
            <div class="journey-item">
              <span class="journey-icon"
                ><i class="bi bi-journal-check" aria-hidden="true"></i
              ></span>
              <div>
                <span class="journey-label">Plan</span
                ><span class="journey-caption">Courses, schedule and budget</span>
              </div>
              <i class="bi bi-check-circle-fill journey-check" aria-hidden="true"></i>
            </div>
            <div class="journey-connector"></div>
            <div class="journey-item">
              <span class="journey-icon"><i class="bi bi-airplane" aria-hidden="true"></i></span>
              <div>
                <span class="journey-label">Get ready</span
                ><span class="journey-caption">Prepare for your next chapter</span>
              </div>
              <i class="bi bi-arrow-up-right journey-next" aria-hidden="true"></i>
            </div>
          </div>
          <p class="about-hero-note small mb-0 mt-3">
            <i class="bi bi-stars me-2" aria-hidden="true"></i>Everything you need to plan ahead.
          </p>
        </div>
      </div>
    </header>

    <div class="row g-4 mb-5">
      <div class="col-12 col-lg-5">
        <article class="about-card about-problem h-100 rounded-4 p-4 p-md-5">
          <span class="about-kicker"
            ><i class="bi bi-signpost-split me-2" aria-hidden="true"></i>The challenge</span
          >
          <h2 class="h3 mt-3 mb-3">Exchange planning can get complicated.</h2>
          <p class="mb-0">
            Comparing universities, checking courses, estimating costs and planning schedules can
            mean juggling information across multiple platforms. Keeping everything organised
            shouldn't be another challenge.
          </p>
        </article>
      </div>
      <div class="col-12 col-lg-7">
        <article class="about-card about-card-highlight h-100 rounded-4 p-4 p-md-5">
          <span class="about-kicker"
            ><i class="bi bi-lightbulb me-2" aria-hidden="true"></i>Why we built it</span
          >
          <h2 class="h3 mt-3 mb-3">One place to bring it all together.</h2>
          <p class="mb-0">
            SMUXchange simplifies exchange planning by bringing university information and practical
            tools into one platform. Explore your options, organise your preferences and build a
            plan with greater clarity.
          </p>
        </article>
      </div>
    </div>

    <section class="about-approach rounded-4 p-4 p-md-5 mb-5" aria-labelledby="approach-heading">
      <div class="row g-4 align-items-center">
        <div class="col-12 col-lg-4">
          <p class="text-uppercase fw-bold small text-primary mb-2">How we help</p>
          <h2 id="approach-heading" class="h3 mb-0">Everything in one place.</h2>
        </div>
        <div class="col-12 col-lg-8">
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <h3 class="h6 fw-bold">
                <i class="bi bi-buildings text-primary me-2" aria-hidden="true"></i>Explore and
                compare
              </h3>
              <p class="mb-0">
                Discover partner universities and compare your shortlisted destinations.
              </p>
            </div>
            <div class="col-12 col-md-6">
              <h3 class="h6 fw-bold">
                <i class="bi bi-book text-primary me-2" aria-hidden="true"></i>Plan your courses
              </h3>
              <p class="mb-0">Browse courses, check credit mappings and manage your selections.</p>
            </div>
            <div class="col-12 col-md-6">
              <h3 class="h6 fw-bold">
                <i class="bi bi-calendar-week text-primary me-2" aria-hidden="true"></i>Build your
                schedule
              </h3>
              <p class="mb-0">Create and save a weekly timetable around your selected courses.</p>
            </div>
            <div class="col-12 col-md-6">
              <h3 class="h6 fw-bold">
                <i class="bi bi-wallet2 text-primary me-2" aria-hidden="true"></i>Estimate your
                costs
              </h3>
              <p class="mb-0">Plan your exchange budget and adjust expenses to suit your needs.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="about-steps rounded-4 p-4 p-md-5" aria-labelledby="steps-heading">
      <div
        class="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 mb-4"
      >
        <div>
          <p class="text-uppercase fw-bold small text-primary mb-2">Getting started</p>
          <h2 id="steps-heading" class="h3 mb-0">Your exchange, step by step.</h2>
        </div>
        <RouterLink class="btn btn-primary" :to="{ name: 'universities' }"
          >Explore Universities</RouterLink
        >
      </div>
      <ol class="about-step-list list-unstyled row g-3 mb-0">
        <li class="col-12 col-md-6 col-xl-3">
          <div class="about-step h-100 rounded-3 p-3">
            <span class="step-index">01</span>
            <h3 class="h6 fw-bold mt-3">Explore destinations</h3>
            <p class="mb-0">Browse university profiles, courses, costs and exchange periods.</p>
          </div>
        </li>
        <li class="col-12 col-md-6 col-xl-3">
          <div class="about-step h-100 rounded-3 p-3">
            <span class="step-index">02</span>
            <h3 class="h6 fw-bold mt-3">Shortlist your choices</h3>
            <p class="mb-0">Save your preferred universities and compare them side by side.</p>
          </div>
        </li>
        <li class="col-12 col-md-6 col-xl-3">
          <div class="about-step h-100 rounded-3 p-3">
            <span class="step-index">03</span>
            <h3 class="h6 fw-bold mt-3">Build your plan</h3>
            <p class="mb-0">Select courses, create your schedule and estimate your budget.</p>
          </div>
        </li>
        <li class="col-12 col-md-6 col-xl-3">
          <div class="about-step h-100 rounded-3 p-3">
            <span class="step-index">04</span>
            <h3 class="h6 fw-bold mt-3">Review your plans</h3>
            <p class="mb-0">Revisit and update your saved choices whenever you need.</p>
          </div>
        </li>
      </ol>
    </section>
  </section>
</template>

<style scoped>
.about-hero {
  position: relative;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(ellipse at 85% 15%, rgba(255, 255, 255, 0.12), transparent 38%),
    linear-gradient(125deg, var(--app-navy) 0%, var(--app-blue) 65%, #3d4785 100%);

  box-shadow: 0 1.25rem 3rem rgba(20, 27, 77, 0.18);
}

.about-hero h1 {
  max-width: 48rem;
}

.about-eyebrow {
  color: #cbdcff;
  letter-spacing: 0.1em;
}

.about-eyebrow-mark {
  display: inline-block;
  width: 1.5rem;
  height: 2px;
  margin: 0 0.5rem 0.2rem 0;
  background: #9fc0fa;
}

.about-intro {
  max-width: 52rem;
  color: #e6edfa;
}

.about-hero-cta {
  color: #0b2348;
  border: 0;
  font-size: 0.95rem;
}

.about-hero-cta:hover {
  color: #0b2348;
  background: #e6edfa;
}

.about-journey-card {
  color: #17375f;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 1rem 2rem rgba(4, 20, 44, 0.2);
}

.journey-globe {
  color: #1f4e9c;
  font-size: 1.2rem;
}

.journey-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.journey-icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.8rem;
  color: #1f4e9c;
  background: #edf3ff;
  font-size: 1.1rem;
}

.journey-item > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.journey-label {
  font-size: 0.9rem;
  font-weight: 700;
}

.journey-caption {
  color: #68778d;
  font-size: 0.76rem;
}

.journey-check,
.journey-next {
  color: #347b65;
}

.journey-connector {
  height: 1rem;
  margin: 0.2rem 0 0.2rem 1.2rem;
  border-left: 1px dashed #bbc9dd;
}

.about-hero-note {
  color: #d7e4fa;
}

.about-card,
.about-approach,
.about-steps {
  border: 1px solid #e8eaf0;
  background: #fff;
  box-shadow: 0 0.5rem 1.5rem rgba(17, 42, 79, 0.04);
}

.about-card-highlight,
.about-approach {
  background: #f8f9fc;
}

.about-kicker {
  color: #1f4e9c;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.about-card p,
.about-approach p,
.about-step p {
  color: #52627a;
  line-height: 1.7;
}

.about-card-highlight {
  border-color: #d9e5f8;
}

.about-approach {
  background: linear-gradient(135deg, #f8f9fc, #fff);
}

.about-approach h3 {
  margin-bottom: 0.5rem;
}

.about-step {
  border: 1px solid #e8eaf0;
  background: #f8f9fc;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.about-step:hover {
  transform: translateY(-3px);
  border-color: #c7d8f2;
  box-shadow: 0 0.75rem 1.5rem rgba(17, 42, 79, 0.08);
}

.step-index {
  display: inline-grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 50%;
  background: #eaf1ff;
  color: #1f4e9c;
  font-size: 0.75rem;
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .about-step {
    transition: none;
  }
  .about-step:hover {
    transform: none;
  }
}
</style>
