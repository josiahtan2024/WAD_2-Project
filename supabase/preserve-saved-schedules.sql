-- Keep saved schedule rows when a course is removed from the course cart.
-- Run this migration once on databases created before university_module_id was added.

ALTER TABLE public.planned_modules
    ADD COLUMN IF NOT EXISTS university_module_id BIGINT;

-- Backfill the stable module reference before cart rows are allowed to disappear.
UPDATE public.planned_modules AS planned
SET university_module_id = cart.university_module_id
FROM public.cart_modules AS cart
WHERE planned.cart_module_id = cart.id
  AND planned.university_module_id IS NULL;

ALTER TABLE public.planned_modules
    ALTER COLUMN university_module_id SET NOT NULL,
    ALTER COLUMN cart_module_id DROP NOT NULL;

ALTER TABLE public.planned_modules
    DROP CONSTRAINT IF EXISTS planned_modules_cart_module_id_user_id_university_id_fkey,
    DROP CONSTRAINT IF EXISTS planned_modules_timetable_id_cart_module_id_key,
    DROP CONSTRAINT IF EXISTS planned_modules_university_module_id_university_id_fkey,
    DROP CONSTRAINT IF EXISTS planned_modules_timetable_id_university_module_id_key;

ALTER TABLE public.planned_modules
    ADD CONSTRAINT planned_modules_university_module_id_university_id_fkey
        FOREIGN KEY (university_module_id, university_id)
        REFERENCES public.university_modules(id, university_id)
        ON DELETE CASCADE,
    ADD CONSTRAINT planned_modules_cart_module_id_user_id_university_id_fkey
        FOREIGN KEY (cart_module_id, user_id, university_id)
        REFERENCES public.cart_modules(id, user_id, university_id)
        ON DELETE SET NULL (cart_module_id),
    ADD CONSTRAINT planned_modules_timetable_id_university_module_id_key
        UNIQUE (timetable_id, university_module_id);

-- Make the new relationship available to Supabase/PostgREST immediately.
NOTIFY pgrst, 'reload schema';
