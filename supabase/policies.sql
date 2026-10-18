-- Run in the Supabase SQL Editor.
-- Enable Row Level Security (RLS) on all tables
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE smu_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_mappings ENABLE ROW LEVEL SECURITY;

ALTER TABLE shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_reviews ENABLE ROW LEVEL SECURITY;

-- Public Read-Only
CREATE POLICY "Allow public read access on universities"
    ON universities FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on university_languages"
    ON university_languages FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on exchange_periods"
    ON exchange_periods FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on university_costs"
    ON university_costs FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on smu_modules"
    ON smu_modules FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on university_modules"
    ON university_modules FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on credit_mappings"
    ON credit_mappings FOR SELECT
    USING (true);

-- Shortlists
CREATE POLICY "Users can manage their own shortlists"
    ON shortlists FOR ALL
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- User Budgets
CREATE POLICY "Users can manage their own budgets"
    ON user_budgets FOR ALL
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Timetables
CREATE POLICY "Users can manage their own timetables"
    ON timetables FOR ALL
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Planned Modules (Enforces ownership through parent timetable relation)
CREATE POLICY "Users can manage planned modules for their timetables"
    ON planned_modules FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM timetables t
            WHERE t.id = planned_modules.timetable_id
              AND t.user_id = (select auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM timetables t
            WHERE t.id = planned_modules.timetable_id
              AND t.user_id = (select auth.uid())
        )
    );

-- Reviews
CREATE POLICY "Allow public read access on university_reviews"
    ON university_reviews FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create their own review"
    ON university_reviews FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
