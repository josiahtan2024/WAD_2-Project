-- Creates every table. Run in the Supabase SQL editor.
create table if not exists universities (
  id bigint generated always as identity primary key,
  name text not null,
  country text not null,
  city text,
  region text not null,
  lat double precision,
  lng double precision,
  currency_code text not null,
  region_band_min numeric,
  region_band_max numeric
);

create table if not exists smu_modules (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null
);

create table if not exists credit_mappings (
  id bigint generated always as identity primary key,
  university_id bigint not null references universities(id) on delete cascade,
  smu_module_id bigint not null references smu_modules(id) on delete cascade,
  foreign_course_code text,
  foreign_course_name text not null,
  notes text
);

create table if not exists shortlists (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id bigint not null references universities(id) on delete cascade,
  unique (user_id, university_id)
);

create table if not exists schedule_blocks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id bigint not null references universities(id) on delete cascade,
  module_name text not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null
);

create table if not exists reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id bigint not null references universities(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
