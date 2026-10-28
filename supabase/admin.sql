-- Admin (staff) role. Run in the Supabase SQL Editor after schema.sql, policies.sql and seed.sql.
-- Safe to run again.
--
-- There are two kinds of user: students (everyone who signs up) and admins.
-- An admin is a user whose app_metadata has role = admin. Users cannot change app_metadata
-- themselves (unlike user_metadata), so the role can only be given from here:
--
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'
--   where email = 'staff@smu.edu.sg';
--
-- The person has to log in again before the role shows up in their session.

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
$$;


-- 1. Universities can be hidden from students until they are ready
alter table universities add column if not exists published boolean not null default true;

create unique index if not exists universities_name_country_key
    on universities (lower(name), lower(country));

drop policy if exists "Allow public read access on universities" on universities;
drop policy if exists "Public can read published universities" on universities;
create policy "Public can read published universities"
    on universities for select
    using (published or public.is_admin());

-- the details of a hidden university stay hidden too (the subquery only sees what the user can see)
do $$
declare
    t text;
begin
    foreach t in array array['university_languages', 'exchange_periods', 'university_costs', 'university_modules']
    loop
        execute format('drop policy if exists "Allow public read access on %1$s" on %1$I', t);
        execute format('drop policy if exists "Public can read details of visible universities" on %I', t);
        execute format(
            'create policy "Public can read details of visible universities" on %I for select using (
                exists (select 1 from universities u where u.id = %I.university_id)
            )', t, t);
    end loop;
end
$$;

drop policy if exists "Allow public read access on credit_mappings" on credit_mappings;
drop policy if exists "Public can read mappings of visible universities" on credit_mappings;
create policy "Public can read mappings of visible universities"
    on credit_mappings for select
    using (
        exists (
            select 1 from university_modules m
            where m.id = credit_mappings.university_module_id
        )
    );

drop policy if exists "Allow public read access on university_reviews" on university_reviews;
drop policy if exists "Public can read reviews of visible universities" on university_reviews;
create policy "Public can read reviews of visible universities"
    on university_reviews for select
    using (exists (select 1 from universities u where u.id = university_reviews.university_id));

drop policy if exists "Allow public read access on review_comments" on review_comments;
drop policy if exists "Public can read comments of visible reviews" on review_comments;
create policy "Public can read comments of visible reviews"
    on review_comments for select
    using (exists (select 1 from university_reviews r where r.id = review_comments.review_id));


-- 2. Only admins can change university data
drop policy if exists "Admins can add universities" on universities;
create policy "Admins can add universities"
    on universities for insert
    to authenticated
    with check (public.is_admin());

drop policy if exists "Admins can edit universities" on universities;
create policy "Admins can edit universities"
    on universities for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- deleting wipes every student's shortlist, budget, review and timetable for it,
-- so it is only allowed once the university has been hidden
drop policy if exists "Admins can delete hidden universities" on universities;
create policy "Admins can delete hidden universities"
    on universities for delete
    to authenticated
    using (public.is_admin() and not published);

do $$
declare
    t text;
begin
    foreach t in array array[
        'university_languages', 'exchange_periods', 'university_costs',
        'university_modules', 'credit_mappings', 'smu_modules'
    ]
    loop
        execute format('drop policy if exists "Admins can manage %s" on %I', t, t);
        execute format(
            'create policy "Admins can manage %s" on %I for all to authenticated
                using (public.is_admin()) with check (public.is_admin())', t, t);
    end loop;
end
$$;


-- 3. Admins can remove reviews and comments (they cannot rewrite them)
drop policy if exists "Admins can delete any review" on university_reviews;
create policy "Admins can delete any review"
    on university_reviews for delete
    to authenticated
    using (public.is_admin());

drop policy if exists "Admins can delete any comment" on review_comments;
create policy "Admins can delete any comment"
    on review_comments for delete
    to authenticated
    using (public.is_admin());


-- 4. Logos and review photos
update storage.buckets set file_size_limit = 2097152 where id = 'university-logos';

drop policy if exists "Allow public read access on university logos" on storage.objects;
create policy "Allow public read access on university logos"
    on storage.objects for select
    using (bucket_id = 'university-logos');

drop policy if exists "Admins can upload university logos" on storage.objects;
create policy "Admins can upload university logos"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'university-logos' and public.is_admin());

drop policy if exists "Admins can delete university logos" on storage.objects;
create policy "Admins can delete university logos"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'university-logos' and public.is_admin());

drop policy if exists "Admins can delete any review image" on storage.objects;
create policy "Admins can delete any review image"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'review-images' and public.is_admin());


-- 5. updated_at is kept by the database, so the browser cannot fake it
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end
$$;

do $$
declare
    t text;
begin
    foreach t in array array[
        'universities', 'exchange_periods', 'university_costs', 'university_modules',
        'credit_mappings', 'smu_modules', 'university_reviews', 'review_comments'
    ]
    loop
        execute format('drop trigger if exists set_updated_at on %I', t);
        execute format(
            'create trigger set_updated_at before update on %I
                for each row execute function public.set_updated_at()', t);
    end loop;
end
$$;


-- 6. What a delete would wipe, shown to the admin before they confirm
create or replace function public.university_impact(p_university_id bigint)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_admin() then
        raise exception 'Only admins can do that' using errcode = '42501';
    end if;

    return json_build_object(
        'shortlists', (select count(*) from public.shortlists where university_id = p_university_id),
        'budgets', (select count(*) from public.user_budgets where university_id = p_university_id),
        'reviews', (select count(*) from public.university_reviews where university_id = p_university_id),
        'timetables', (select count(*) from public.timetables where university_id = p_university_id)
    );
end
$$;

revoke execute on function public.university_impact(bigint) from public, anon;
grant execute on function public.university_impact(bigint) to authenticated;
