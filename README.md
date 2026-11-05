# SMU Exchange Planner

SMUXchange helps SMU students explore partner universities and prepare for an exchange. University information and planning tools come together to help students compare destinations, consider courses and costs, and build a plan for their exchange.

## Features

- **Explore universities:** Search by keyword, filter by region, sort by name, country, or estimated cost, and open a university profile.
- **Learn about the project:** Visit the About Us page to learn about the exchange-planning problem SMUXchange addresses, the tools it provides, and how to get started.
- **Review university details:** See university information, estimated costs, and student reviews. Signed-in users can submit a review.
- **Shortlist options:** Save universities to a personal shortlist for later planning.
- **Compare universities:** Review shortlisted choices side by side.
<<<<<<< Updated upstream
- **Check credit mappings:** Review how courses at a partner university map to SMU courses to help plan your exchange modules.
- **Plan a weekly schedule:** View and edit a weekly schedule for a university and save it to your account. 
=======
- **Check credit mappings:** Review how courses at a partner university map to SMU courses to help plan your exchange modules and save them into a cart to plan a weekly schedule.
- **Plan a weekly schedule:** View and edit a weekly schedule for a university and save it to your account. Checks and prevents students from scheduling classes with clashing timeslots.
>>>>>>> Stashed changes
- **Estimate exchange costs:** Set the exchange duration and monthly accommodation, food, transport, personal, and other expenses. The planner can use published estimates as a starting point and show local currency and SGD totals when exchange-rate data is available.
- **Create an account:** Sign up and log in through Supabase Authentication. Shortlists, schedules, and budget planning require a signed-in account.
- **Manage universities (staff):** Admins can add, edit, hide, and delete universities and their details, and remove reviews and comments. See [Admin accounts](#admin-accounts).

## How to use the app

1. Open **Universities** and search, filter by region, or sort the list. Select a university to view its profile, estimated costs, credit mappings between partner and SMU courses, exchange periods, and student reviews.
2. **Sign Up or Log In** to shortlist universities, write a review, and save your plans.
3. Open **Compare** to review shortlisted universities side by side.
4. Open **Shortlist** to see the universities you shortlisted, see their details and plan schedules for them quickly and conveniently.
5. Open **Courses** to search and add the courses you are considering to your cart. Check the credit mappings as you plan. 
6. Open **Budget** to enter your exchange duration and monthly expenses, then save and refine your budget.
7. Open **Schedule** to select a university and exchange period, create or edit a weekly timetable using courses in your cart, and save it.
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
- pnpm
- A Supabase project

### Setup

1. Install the dependencies:

   ```sh
   pnpm install
   ```

2. Copy `.env.example` to `.env` and set the Supabase URL and public anon key from **Project Settings > API**.

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. In the Supabase SQL Editor, run these files in order:

   ```text
   supabase/schema.sql
   supabase/seed.sql
   supabase/policies.sql
   supabase/preserve-saved-schedules.sql
   ```

   Run `supabase/preserve-saved-schedules.sql` on an existing database as well. It updates saved schedules so they no longer depend on cart entries.

4. In Supabase Authentication settings for this development project, disable email confirmation or mark the test users' email addresses as confirmed.

5. Create the local student and admin test users listed in [Local test accounts](#local-test-accounts) under **Authentication > Users**.

6. Run `supabase/admin.sql` in the SQL Editor. It promotes the admin account and applies the staff policies.

7. Start the development server:

   ```sh
   pnpm dev
   ```

8. Open the local URL printed by Vite (usually `http://localhost:5173`).

### Local test accounts

These are development-only credentials. Create both users in your development Supabase project before signing in; the SQL files do not create Auth users. Never use these credentials in a production project.

| Role    | Email                     | Password                    |
| ------- | ------------------------- | --------------------------- |
| Student | `student@smu.edu.sg`       | `student123` |
| Admin   | `staff@smu.edu.sg` | `password` |

The student E2E tests use the student credentials by default. To configure both test accounts explicitly, copy `.env.test.example` to `.env.test` and adjust the values if needed:

```powershell
Copy-Item .env.test.example .env.test
```

The admin tests are skipped unless `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in `.env.test`.

### Admin accounts

There are two kinds of user: students and admins (staff). An admin can do everything a student can, and can also add, edit, hide, and delete universities and remove reviews and comments. A new university starts hidden from students until an admin publishes it, and only a hidden university can be deleted.

The `supabase/admin.sql` setup sets `role` to `admin` in the staff account's `app_metadata`. To promote a different account, replace the email in that file with the account's email, run the update in the Supabase SQL Editor, and have the user log in again:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'
where email = 'staff@smu.edu.sg';
```

Admins see an extra **Staff** badge in the navigation bar, and a **View as student** switch to check what students see.

### Environment variables

| Variable                 | Description                  |
| ------------------------ | ---------------------------- |
| `VITE_SUPABASE_URL`      | URL of your Supabase project |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key     |

Do not put a Supabase service-role key in frontend environment variables.

## Development commands

```sh
pnpm dev                 # Start the Vite development server
pnpm build               # Create a production build in dist/
pnpm preview             # Preview the production build locally
pnpm lint                # Run ESLint
pnpm test:functional     # Run the functional test suite (no account or database needed)
pnpm test                # Run the live Playwright end-to-end tests
```

The functional suite in `tests/functional` builds the app and drives it in a real browser against a built-in fake Supabase, so it runs anywhere with no keys, no account and no network. See [tests/functional/README.md](tests/functional/README.md) for what it covers and how to add to it.

The live tests in `tests/e2e` use a real browser and the development Supabase project. Install the browser once with `pnpm exec playwright install chromium`, then create the student and admin test users above. Test credentials can be set in `.env.test`; admin tests skip when admin credentials are absent.

## Deployment

The project can be deployed to Vercel as a Vite app. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project environment. The included `vercel.json` rewrites application routes to `index.html` to support direct navigation and page refreshes.
Deployment Link: wad-2-project-ten.vercel.app

## Data notes

University and cost records are initialized from `supabase/seed.sql`. Treat seeded estimates as planning guidance and verify current costs and exchange requirements with the university before making travel or financial decisions. Exchange rates are retrieved from Frankfurter when available.

## Use of AI/LLM

AI/LLM tools were used only for the lower-order tasks the course allows.
The application's business logic, backend queries and feature
implementation were written by the team.

**Parts that rely mainly on AI/LLM**
- The functional test suite in `tests/functional/`: the spec files, the
  fake Supabase backend used as mock data (`support/backend.js`, `seed.js`),
  and its README.
- The GitHub Actions job and npm script that run the functional suite.

**Where AI/LLM assisted**
- Explaining errors and suggesting debugging hints, for example failing CI
  runs and test selectors that broke after UI changes.
- Generating test cases for unit and e2e testing, sample inputs and mock data.
- Boilerplate and starter code for the test setup.

**Not done with AI/LLM**
- Core implementation: the Vue components, Pinia stores, Supabase queries
  and the main app features.
- Problem solving on the application itself. The team diagnosed and fixed
  issues the tests found in the app.
