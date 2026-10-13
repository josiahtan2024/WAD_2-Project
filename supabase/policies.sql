-- TODO(student): Row-level security. Write the policies yourself.
-- Needed:
--   * universities, smu_modules, credit_mappings: enable RLS, anyone can SELECT
--   * shortlists, schedule_blocks: a user can SELECT/INSERT/UPDATE/DELETE only rows where user_id = auth.uid()
--   * reviews: anyone can SELECT, only logged-in users can INSERT (with user_id = auth.uid())

-- for cost and budgetting 
ALTER TABLE public.university_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read university costs"
ON public.university_costs;

CREATE POLICY "Public can read university costs"
ON public.university_costs
FOR SELECT
TO anon, authenticated
USING (true);

ALTER TABLE public.user_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own budgets"
ON public.user_budgets;

CREATE POLICY "Users manage their own budgets"
ON public.user_budgets
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_university_costs_university
ON public.university_costs(university_id);

CREATE INDEX IF NOT EXISTS idx_user_budgets_user
ON public.user_budgets(user_id);