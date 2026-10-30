-- Run in the Supabase SQL Editor. 
-- schema.sql >> seed.sql >> polices.sql >> admin.sql
-- Replace 'staff@smu.edu.sg' with the email of the staff to promote
UPDATE auth.users
SET raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"role": "admin"}'
WHERE email = 'staff@smu.edu.sg';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
        FALSE
    );
$$;

DROP POLICY IF EXISTS "Allow public read access on universities" ON universities;
CREATE POLICY "Public can read visible universities"
    ON universities FOR SELECT
    USING (published OR public.is_admin());

DROP POLICY IF EXISTS "Allow public read access on university_languages" ON university_languages;
CREATE POLICY "Public can read details of visible university_languages"
    ON university_languages FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM universities u WHERE u.id = university_languages.university_id)
    );

DROP POLICY IF EXISTS "Allow public read access on exchange_periods" ON exchange_periods;
CREATE POLICY "Public can read details of visible exchange_periods"
    ON exchange_periods FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM universities u WHERE u.id = exchange_periods.university_id)
    );

DROP POLICY IF EXISTS "Allow public read access on university_costs" ON university_costs;
CREATE POLICY "Public can read details of visible university_costs"
    ON university_costs FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM universities u WHERE u.id = university_costs.university_id)
    );

DROP POLICY IF EXISTS "Allow public read access on university_modules" ON university_modules;
CREATE POLICY "Public can read details of visible university_modules"
    ON university_modules FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM universities u
            WHERE u.id = university_modules.university_id
              AND (u.published = true OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "Allow public read access on credit_mappings" ON credit_mappings;
CREATE POLICY "Public can read mappings of visible universities"
    ON credit_mappings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM university_modules m
            WHERE m.id = credit_mappings.university_module_id
        )
    );

DROP POLICY IF EXISTS "Allow public read access on university_reviews" ON university_reviews;
CREATE POLICY "Public can read reviews of visible universities"
    ON university_reviews FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM universities u WHERE u.id = university_reviews.university_id)
    );

DROP POLICY IF EXISTS "Allow public read access on review_comments" ON review_comments;
CREATE POLICY "Public can read comments of visible reviews"
    ON review_comments FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM university_reviews r WHERE r.id = review_comments.review_id)
    );

DROP POLICY IF EXISTS "Users can manage their own shortlists" ON shortlists;
DROP POLICY IF EXISTS "Users can shortlist visible universities" ON shortlists;
CREATE POLICY "Users can shortlist visible universities"
    ON shortlists FOR ALL
    TO authenticated
    USING (
        (select auth.uid()) = user_id
        AND EXISTS (
            SELECT 1 FROM universities u
            WHERE u.id = shortlists.university_id
              AND (u.published = true OR public.is_admin())
        )
    )
    WITH CHECK (
        (select auth.uid()) = user_id
        AND EXISTS (
            SELECT 1 FROM universities u
            WHERE u.id = shortlists.university_id
              AND (u.published = true OR public.is_admin())
        )
    );

CREATE POLICY "Admins can add universities"
    ON universities FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can edit universities"
    ON universities FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete hidden universities"
    ON universities FOR DELETE
    TO authenticated
    USING (public.is_admin() AND NOT published);

CREATE POLICY "Admins can manage university_languages"
    ON university_languages FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage exchange_periods"
    ON exchange_periods FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage university_costs"
    ON university_costs FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage university_modules"
    ON university_modules FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage credit_mappings"
    ON credit_mappings FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage smu_modules"
    ON smu_modules FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete any review"
    ON university_reviews FOR DELETE
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can delete any comment"
    ON review_comments FOR DELETE
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can upload university logos" ON storage.objects;
CREATE POLICY "Admins can upload university logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'university-logos' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete university logos" ON storage.objects;
CREATE POLICY "Admins can delete university logos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'university-logos' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any review image" ON storage.objects;
CREATE POLICY "Admins can delete any review image"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'review-images' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON universities
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON exchange_periods
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON university_costs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON university_modules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON credit_mappings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON smu_modules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON university_reviews
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON review_comments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.university_impact(p_university_id BIGINT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can do that' USING errcode = '42501';
    END IF;

    RETURN json_build_object(
        'shortlists', (SELECT count(*) FROM public.shortlists WHERE university_id = p_university_id),
        'budgets', (SELECT count(*) FROM public.user_budgets WHERE university_id = p_university_id),
        'reviews', (SELECT count(*) FROM public.university_reviews WHERE university_id = p_university_id),
        'timetables', (SELECT count(*) FROM public.timetables WHERE university_id = p_university_id)
    );
END
$$;

REVOKE EXECUTE ON FUNCTION public.university_impact(BIGINT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.university_impact(BIGINT) TO authenticated;
