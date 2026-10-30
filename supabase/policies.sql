-- Run in the Supabase SQL Editor.
-- schema.sql >> seed.sql >> polices.sql >> admin.sql
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
ALTER TABLE cart_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;

-- Public Read-Only
CREATE POLICY "Allow public read access on universities"
    ON universities FOR SELECT
    USING (published = true);

CREATE POLICY "Allow public read access on university_languages"
    ON university_languages FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM universities u
        WHERE u.id = university_languages.university_id AND u.published = true
    ));

CREATE POLICY "Allow public read access on exchange_periods"
    ON exchange_periods FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM universities u
        WHERE u.id = exchange_periods.university_id AND u.published = true
    ));

CREATE POLICY "Allow public read access on university_costs"
    ON university_costs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM universities u
        WHERE u.id = university_costs.university_id AND u.published = true
    ));

CREATE POLICY "Allow public read access on smu_modules"
    ON smu_modules FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on university_modules"
    ON university_modules FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM universities u
        WHERE u.id = university_modules.university_id AND u.published = true
    ));

CREATE POLICY "Allow public read access on credit_mappings"
    ON credit_mappings FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM university_modules m
        JOIN universities u ON u.id = m.university_id
        WHERE m.id = credit_mappings.university_module_id AND u.published = true
    ));

-- Shortlists
CREATE POLICY "Users can manage their own shortlists"
    ON shortlists FOR ALL
    TO authenticated
    USING (
        (select auth.uid()) = user_id
        AND EXISTS (
            SELECT 1 FROM universities u
            WHERE u.id = shortlists.university_id AND u.published = true
        )
    )
    WITH CHECK (
        (select auth.uid()) = user_id
        AND EXISTS (
            SELECT 1 FROM universities u
            WHERE u.id = shortlists.university_id AND u.published = true
        )
    );

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

-- Cart Modules
CREATE POLICY "Users can manage their own cart modules"
    ON cart_modules FOR ALL
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Planned Modules
CREATE POLICY "Users can manage their own planned modules"
    ON planned_modules FOR ALL
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Reviews
CREATE POLICY "Allow public read access on university_reviews"
    ON university_reviews FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM universities u
        WHERE u.id = university_reviews.university_id AND u.published = true
    ));

CREATE POLICY "Authenticated users can create their own review"
    ON university_reviews FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Authenticated users can update their own review"
    ON university_reviews FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Authenticated users can delete their own review"
    ON university_reviews FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Allow public read access on review images" ON storage.objects;
CREATE POLICY "Allow public read access on review images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'review-images');

DROP POLICY IF EXISTS "Authenticated users can upload their own review images" ON storage.objects;
CREATE POLICY "Authenticated users can upload their own review images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'review-images' AND (storage.foldername(name))[1] = (select auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users can delete their own review images" ON storage.objects;
CREATE POLICY "Authenticated users can delete their own review images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'review-images' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "Allow public read access on review_comments"
    ON review_comments FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can comment"
    ON review_comments FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Authenticated users can update their own comments"
    ON review_comments FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Authenticated users can delete their own comments"
    ON review_comments FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
