# Functional tests

These tests build the real app, open it in a real browser and use it the way a student or staff member would. The backend is a built-in fake of Supabase (`support/backend.js`), so they need **no keys, no account, no database and no internet**.

```sh
npm run test:functional                       # everything (desktop + phone)
npx playwright test --config=playwright.functional.config.js --project=desktop reviews.spec.js
npx playwright test --config=playwright.functional.config.js --ui   # watch it run
```

## How the fake backend works

- `support/backend.js` answers the same web requests Supabase would: sign-in and sign-up, the data API (filters, joins, ordering, inserts, upserts, deletes) and file storage.
- `support/schema.js` and `support/policies.js` copy the database rules (required fields, unique pairs, checks, cascades) and the row-level security from `supabase/*.sql`. If you change the SQL, change these too.
- `support/seed.js` holds the sample data: 14 visible universities, one hidden one (Atlantis Institute), two seeded reviews and a comment on University College London.
- Tests make people with the `student` and `admin` fixtures, sign them in with `signIn(page, user, backend)`, and can add data directly (`backend.shortlist`, `backend.fillCart`, `backend.rows(table).push(...)`).
- `backend.fail(...)`, `backend.slow(...)`, `backend.goOffline()` simulate a failing, slow or missing server. `person()` opens a second browser for "two people at once" tests.
- Any request to a host the tests do not fake fails the test, so nothing quietly reaches the internet.

## What is covered

| File | Covers |
| --- | --- |
| `smoke` | The app starts |
| `auth` | Sign up, log in, log out, redirects, validation, server errors, sessions across tabs |
| `navigation` | Menu per role, titles, back/forward, direct links, footer |
| `home` | Map, region list, info panel, markers |
| `universities-list` | Search, filters, sort, paging, shortlist from the list |
| `university-detail` | Every section of a university page, credit mapping |
| `shortlist` | List, sort, remove, empty and error states |
| `compare` | Three slots, remembered selection, currencies, periods, shortlisting |
| `courses` | Course search filters, URL sharing, cart, 10-per-university limit |
| `budget` | Create, read, edit, delete, validation, one per university, search and sort |
| `schedule` | Choosing a period, building a timetable, save, edit, delete, unsaved-change prompts |
| `reviews` | Post, edit, delete, photos, comments, safe text, moderation |
| `admin` | Add, edit each section, publish/hide, delete with impact, student view |
| `permissions` | One student cannot see or change another's data; visitors and the staff role |
| `resilience` | Slow, failing and offline servers; expired and revoked sessions |
| `mobile` | Phone-sized screen: no sideways scrolling, menu, touch use |
| `a11y` | Names and labels, alt text, headings, keyboard use |

## Known gaps

Tests marked `test.fixme` describe behaviour that should exist but does not yet. They are skipped, and show up in the report so they are not forgotten. Remove the `.fixme` when the app is fixed:

- Shortlist: a slow response can overwrite a newer click (race).
- Home: `/?university=5` does not select that university.
- Auth: a failing auth service shows `{}` instead of a readable message.
- Navigation: there is no "page not found" page.
- Schedule: "Schedule saved." disappears straight away.
- Resilience: a revoked session is not signed out.
- Accessibility: the home page has no main heading; dialogs do not take keyboard focus; the login error is not announced.

## Writing a new test

Pick elements the way a person would (`getByRole`, `getByLabel`, text) and fall back to `data-testid` when the page offers nothing better. Check what the user sees, and also what was saved (`backend.rows(...)`).
