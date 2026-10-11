#!/usr/bin/env bash
# Repo hygiene checks run by CI. Safe to run locally: bash scripts/check-repo.sh
set -u
fail=0
err() { echo "::error::$1"; fail=1; }

tracked=$(git ls-files)

# 1. Files that must never be committed
echo "$tracked" | grep -E '(^|/)\.env($|\.local$|\.[a-z]+\.local$)' && err "A real .env file is committed. Remove it (git rm --cached) and rotate the keys."
echo "$tracked" | grep -E '^(node_modules|dist)/' | head -1 | grep -q . && err "node_modules/ or dist/ is committed. Check .gitignore."

# 2. Leftover merge-conflict markers
if git grep -nE '^(<<<<<<< |=======$|>>>>>>> )' -- . ':!package-lock.json' ':!scripts/check-repo.sh'; then
  err "Merge conflict markers found. Resolve them before pushing."
fi

# 3. Secrets in code (the secret / service_role key must never reach the browser)
if git grep -nIE 'sb_secret_[A-Za-z0-9_-]+|service_role|SUPABASE_SERVICE' -- . ':!scripts/check-repo.sh' ':!.github' ':!README.md'; then
  err "Possible Supabase secret/service_role key in the repo. Use only the publishable (anon) key."
fi
if git grep -nIE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.' -- . ':!package-lock.json'; then
  err "A JWT-looking string is committed. Keys belong in .env, not in code."
fi

# 4. Leftover .only in tests would silently skip the rest of the suite
if git grep -nE '\.only\(' -- tests; then
  err "test.only / describe.only found in tests/."
fi

# 5. Every route/test hook must use data-testid (tests select by testid only)
if git grep -nE 'getBy(Text|Role|Label|Placeholder)\(|page\.locator\(' -- tests; then
  err "Tests must select elements by data-testid only (page.getByTestId)."
fi

# 6. Only one Supabase client
if git grep -nE 'createClient\(' -- src ':!src/lib/supabase.js'; then
  err "Create the Supabase client only in src/lib/supabase.js and import it."
fi

[ "$fail" = 0 ] && echo "Repo checks passed."
exit "$fail"
