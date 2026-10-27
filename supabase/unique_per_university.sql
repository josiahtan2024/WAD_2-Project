-- One budget and one timetable per user PER UNIVERSITY (schema.sql used to allow one per user in total).
-- For a database that was created from the old schema.sql. Run in the Supabase SQL Editor. Safe to run again.
-- Existing rows already satisfy the looser rule, so no data needs fixing first.

alter table timetables drop constraint if exists timetables_user_id_key;
alter table timetables drop constraint if exists timetables_user_id_university_id_key;
alter table timetables
    add constraint timetables_user_id_university_id_key unique (user_id, university_id);
