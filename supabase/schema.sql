-- Run in the Supabase SQL Editor.
-- 1. Universities & Localization

CREATE TABLE IF NOT EXISTS universities (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    state TEXT,
    city TEXT,
    region TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    long DOUBLE PRECISION NOT NULL,
    timezone TEXT,
    website_url TEXT,
    modules_url TEXT,
    logo_url TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS university_languages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    instruction_language TEXT NOT NULL,
    UNIQUE (university_id, instruction_language)
);

CREATE TABLE IF NOT EXISTS exchange_periods (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    period_name TEXT NOT NULL,
    term TEXT,
    academic_year TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    min_temperature INT,
    max_temperature INT,
    description TEXT,

    -- Supports composite foreign keys that verify university ownership.
    UNIQUE (id, university_id),

    CHECK (
        end_date >= start_date
    ),
    CHECK (
        max_temperature >= min_temperature
    )
);

CREATE TABLE IF NOT EXISTS university_costs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id BIGINT NOT NULL UNIQUE
        REFERENCES universities(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL,
    accommodation NUMERIC CHECK (accommodation >= 0),
    food NUMERIC CHECK (food >= 0),
    transport NUMERIC CHECK (transport >= 0),
    personal_expenses NUMERIC CHECK (personal_expenses >= 0),
    other_expenses NUMERIC CHECK (other_expenses >= 0)
);


-- 2. Academics & Curriculum

CREATE TABLE IF NOT EXISTS smu_modules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_area TEXT UNIQUE NOT NULL,
    school TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS university_modules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    module_name TEXT NOT NULL,
    description TEXT,
    language TEXT,

    UNIQUE (university_id, module_name),
    UNIQUE (id, university_id)
);

CREATE TABLE IF NOT EXISTS credit_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    smu_module_id BIGINT NOT NULL
        REFERENCES smu_modules(id) ON DELETE CASCADE,
    university_module_id BIGINT NOT NULL
        REFERENCES university_modules(id) ON DELETE CASCADE,
    notes TEXT,

    UNIQUE (smu_module_id, university_module_id)
);


-- 3. User Personalization & Planner

CREATE TABLE IF NOT EXISTS shortlists (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,

    UNIQUE (user_id, university_id)
);

CREATE TABLE IF NOT EXISTS user_budgets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    exchange_period_id BIGINT,
    duration_months INT CHECK (duration_months > 0),
    currency_code TEXT NOT NULL DEFAULT 'SGD',
    total_budget NUMERIC CHECK (total_budget >= 0),
    accommodation_budget NUMERIC CHECK (accommodation_budget >= 0),
    food_budget NUMERIC CHECK (food_budget >= 0),
    transport_budget NUMERIC CHECK (transport_budget >= 0),
    personal_budget NUMERIC CHECK (personal_budget >= 0),
    other_budget NUMERIC CHECK (other_budget >= 0),

    -- One budget per user per university
    UNIQUE (user_id, university_id),

    FOREIGN KEY (exchange_period_id, university_id)
        REFERENCES exchange_periods(id, university_id)
        ON DELETE SET NULL (exchange_period_id)
);

CREATE TABLE IF NOT EXISTS university_reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    exchange_period_id BIGINT,
    rating NUMERIC(2,1) NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review TEXT,

    FOREIGN KEY (exchange_period_id, university_id)
        REFERENCES exchange_periods(id, university_id)
        ON DELETE SET NULL (exchange_period_id)
);

CREATE TABLE IF NOT EXISTS timetables (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    exchange_period_id BIGINT NOT NULL,

    -- One timetable per user per university
    UNIQUE (user_id, university_id),
    UNIQUE (id, university_id, exchange_period_id),

    FOREIGN KEY (exchange_period_id, university_id)
        REFERENCES exchange_periods(id, university_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS planned_modules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timetable_id BIGINT NOT NULL
        REFERENCES timetables(id) ON DELETE CASCADE,
    university_module_id BIGINT NOT NULL
        REFERENCES university_modules(id) ON DELETE CASCADE,
    section TEXT,
    day_of_week TEXT,
    start_time TIME,
    end_time TIME,
    location TEXT,
    session_type TEXT,

    UNIQUE (timetable_id, university_module_id),

    CHECK (
        (start_time IS NULL AND end_time IS NULL)
        OR 
        (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
    )
);
