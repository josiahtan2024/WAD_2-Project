# SMU Exchange Planner

Pre-exchange planning tool for SMU students (IS216 group project). Pick partner universities, see estimated costs in SGD and local currency, view credit mappings, plan a weekly schedule, compare shortlisted universities and read reviews.

- **Live URL:** TODO
- **Git repo:** TODO
- **Dummy login:** TODO (email / password, create it in Supabase Auth)

## Setup

Requires Node 18+.

1. `npm install`
2. `cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase project settings, API).
3. In the Supabase SQL editor run, in order: `supabase/schema.sql`, `supabase/seed.sql`, `supabase/policies.sql`.
4. In Supabase Auth settings, turn off "Confirm email" for development so signup works immediately.
5. `npm run dev` and open http://localhost:5173

## Run the tests

Playwright tests drive a real browser against the dev server, so steps 1 to 5 above must be done first, and the dummy account must exist.

```
npx playwright install chromium          # first time only
TEST_EMAIL=you@smu.edu.sg TEST_PASSWORD=yourpassword npm test
```

Tests select elements by `data-testid` only. `tests/e2e/helpers.js` holds shared login and reset helpers.

## Deploy (Vercel)

Import the GitHub repo in Vercel, framework preset "Vite". Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables. `vercel.json` rewrites all routes to `index.html` so refreshes on deep links work.

## Data sources

Seed data in `supabase/seed.sql` is placeholder. TODO: replace with verified data and cite SMU's outgoing-exchange cost page here.

## External services and libraries

Vue 3, Vue Router, Pinia, Bootstrap 5, Supabase, Leaflet (map tiles by OpenStreetMap contributors), Frankfurter (exchange rates, https://www.frankfurter.app), Playwright, Vite.


