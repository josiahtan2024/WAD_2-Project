-- Reviews, topic ratings, comments and review photos.
-- Run in the Supabase SQL Editor after schema.sql and policies.sql. Safe to run again.
--
-- To wipe only these pieces first:
--   drop table if exists review_comments cascade;

-- 1. One review per user per university (schema.sql had one review per user in total)
alter table university_reviews drop constraint if exists university_reviews_user_id_key;
alter table university_reviews drop constraint if exists university_reviews_user_id_university_id_key;
alter table university_reviews
    add constraint university_reviews_user_id_university_id_key unique (user_id, university_id);

alter table university_reviews
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists image_path text,
    add column if not exists academics_rating smallint check (academics_rating between 1 and 5),
    add column if not exists accommodation_rating smallint check (accommodation_rating between 1 and 5),
    add column if not exists cost_rating smallint check (cost_rating between 1 and 5),
    add column if not exists campus_rating smallint check (campus_rating between 1 and 5);

alter table university_reviews drop constraint if exists university_reviews_review_length;
alter table university_reviews
    add constraint university_reviews_review_length check (char_length(review) <= 2000);

create index if not exists university_reviews_university_id_idx
    on university_reviews (university_id, created_at desc);

-- 2. Comments on reviews
create table if not exists review_comments (
    id bigint generated always as identity primary key,
    review_id bigint not null
        references university_reviews(id) on delete cascade,
    user_id uuid not null
        references auth.users(id) on delete cascade,
    body text not null check (char_length(btrim(body)) between 1 and 500),
    created_at timestamptz not null default now()
);

create index if not exists review_comments_review_id_idx on review_comments (review_id);

-- 3. Row level security
alter table review_comments enable row level security;

drop policy if exists "Users can delete their own review" on university_reviews;
create policy "Users can delete their own review"
    on university_reviews for delete
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Allow public read access on review_comments" on review_comments;
create policy "Allow public read access on review_comments"
    on review_comments for select
    using (true);

drop policy if exists "Authenticated users can comment as themselves" on review_comments;
create policy "Authenticated users can comment as themselves"
    on review_comments for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own comments" on review_comments;
create policy "Users can delete their own comments"
    on review_comments for delete
    to authenticated
    using ((select auth.uid()) = user_id);

-- 4. Review photos: public bucket, each user writes only inside their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-images', 'review-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read review images" on storage.objects;
create policy "Anyone can read review images"
    on storage.objects for select
    using (bucket_id = 'review-images');

drop policy if exists "Users can upload review images to their own folder" on storage.objects;
create policy "Users can upload review images to their own folder"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'review-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

drop policy if exists "Users can delete their own review images" on storage.objects;
create policy "Users can delete their own review images"
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'review-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );
