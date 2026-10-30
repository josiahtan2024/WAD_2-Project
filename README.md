# SMU Exchange Planner

SMUXchange helps SMU students explore partner universities and prepare for an exchange. University information and planning tools come together to help students compare destinations, consider courses and costs, and build a plan for their exchange.

## Features

- **Explore universities:** Search by keyword, filter by region, sort by name, country, or estimated cost, and open a university profile.
- **Learn about the project:** Visit the About Us page from the site footer to learn about the exchange-planning problem SMUXchange addresses, the tools it provides, and how to get started.
- **Review university details:** See university information, estimated costs, and student reviews. Signed-in users can submit a review.
- **Shortlist options:** Save universities to a personal shortlist for later planning.
- **Compare universities:** Review shortlisted choices side by side.
- **Check credit mappings:** Review how courses at a partner university map to SMU courses to help plan your exchange modules.
- **Plan a weekly schedule:** View and edit a weekly schedule for a university and save it to your account.
- **Estimate exchange costs:** Set the exchange duration and monthly accommodation, food, transport, personal, and other expenses. The planner can use published estimates as a starting point and show local currency and SGD totals when exchange-rate data is available.
- **Create an account:** Sign up and log in through Supabase Authentication. Shortlists, schedules, and budget planning require a signed-in account.
- **Manage universities (staff):** Admins can add, edit, hide, and delete universities and their details, and remove reviews and comments. See [Admin accounts](#admin-accounts).

## How to use the app

1. Open **Universities** and search, filter by region, or sort the list.
2. Select a university to view its profile, estimated costs, credit mappings between partner and SMU courses, exchange periods, and student reviews.
3. Sign up or log in to shortlist universities, write a review, and save your plans.
4. Open **Compare** to review shortlisted universities side by side.
5. Search for courses and add the courses you are considering to your cart. Check the credit mappings as you plan.
6. Open **Schedule** to select a university and exchange period, create or edit a weekly timetable using courses in your cart, and save it.
7. Open **Cost Estimator** to enter your exchange duration and monthly expenses, then save and refine your budget.
8. Select **About Us** in the footer for an overview of the project and a quick guide to using the site.

## Tech stack

- **Frontend:** Vue 3, Vue Router, and Pinia
- **UI:** Bootstrap 5 and Bootstrap Icons
- **Backend and database:** Supabase (PostgreSQL and Authentication)
- **Map:** Leaflet with OpenStreetMap tiles
- **Exchange rates:** Frankfurter API
- **Build and development:** Vite
- **Deployment:** Vercel
- **End-to-end tests:** Playwright
- **Code checks:** ESLint

## Getting started

### Requirements

- Node.js 18 or later
- npm
- A Supabase project

### Setup

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set the Supabase project URL and public anon key from **Supabase Project Settings → API**.

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. In the Supabase SQL Editor, run these files in order:

   ```text
   supabase/schema.sql
   supabase/seed.sql
   supabase/policies.sql
   supabase/admin.sql
   ```

4. For local development, disable email confirmation in Supabase Authentication settings if you want new accounts to be usable immediately after signup.

5. Start the development server:

   ```sh
   npm run dev
   ```

6. Open the local URL printed by Vite (usually `http://localhost:5173`).

### Admin accounts

There are two kinds of user: students (anyone who signs up) and admins (staff). An admin can do everything a student can, and can also add, edit, hide, and delete universities and remove reviews and comments. A new university starts hidden from students until an admin publishes it, and only a hidden university can be deleted.

A user becomes an admin when `role` is set to `admin` in their `app_metadata`. Users cannot change `app_metadata` themselves, so this is done in the Supabase SQL Editor, and the person has to log in again afterwards:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'
where email = 'staff@smu.edu.sg';
```

Admins see an extra **Staff** badge in the navigation bar, and a **View as student** switch to check what students see.

### Environment variables

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | URL of your Supabase project |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |

Do not put a Supabase service-role key in frontend environment variables.

## Development commands

```sh
npm run dev       # Start the Vite development server
npm run build     # Create a production build in dist/
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
npm test          # Run Playwright end-to-end tests
```

Playwright tests use a real browser and a configured Supabase account. Install the browser once with `npx playwright install chromium`, then provide `TEST_EMAIL` and `TEST_PASSWORD` for the test account before running `npm test`. The tests also expect the local environment and database to be set up. The admin tests in `tests/e2e/admin.spec.js` need an admin account, given as `ADMIN_EMAIL` and `ADMIN_PASSWORD`, and skip themselves without one.

## Deployment

The project can be deployed to Vercel as a Vite app. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project environment. The included `vercel.json` rewrites application routes to `index.html` to support direct navigation and page refreshes.

## Data notes

University and cost records are initialized from `supabase/seed.sql`. Treat seeded estimates as planning guidance and verify current costs and exchange requirements with the university before making travel or financial decisions. Exchange rates are retrieved from Frankfurter when available.
