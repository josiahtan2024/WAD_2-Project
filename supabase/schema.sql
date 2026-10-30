-- Run in the Supabase SQL Editor. 
-- schema.sql >> seed.sql >> polices.sql >> admin.sql
-- 1. Universities & Localization
CREATE TABLE IF NOT EXISTS universities (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    state TEXT,
    city TEXT,
    region TEXT NOT NULL,
    lat DOUBLE PRECISION CHECK (lat BETWEEN -90 AND 90),
    long DOUBLE PRECISION CHECK (long BETWEEN -180 AND 180),
    timezone TEXT,
    website_url TEXT,
    modules_url TEXT,
    logo_url TEXT,
    description TEXT,
    published BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS university_languages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    instruction_language TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (university_id, instruction_language)
);

CREATE TABLE IF NOT EXISTS exchange_periods (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    period_name TEXT NOT NULL,
    term TEXT,
    academic_year TEXT,
    start_date DATE,
    end_date DATE,
    min_temperature INT,
    max_temperature INT,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (id, university_id),

    CHECK (
        start_date IS NULL OR end_date IS NULL OR end_date >= start_date
    ),
    CHECK (
        min_temperature IS NULL OR max_temperature IS NULL OR max_temperature >= min_temperature
    )
);

CREATE TABLE IF NOT EXISTS university_costs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id BIGINT NOT NULL UNIQUE
        REFERENCES universities(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
    accommodation NUMERIC CHECK (accommodation >= 0),
    food NUMERIC CHECK (food >= 0),
    transport NUMERIC CHECK (transport >= 0),
    personal_expenses NUMERIC CHECK (personal_expenses >= 0),
    other_expenses NUMERIC CHECK (other_expenses >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2. Academics & Curriculum
CREATE TABLE IF NOT EXISTS smu_modules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_area TEXT UNIQUE NOT NULL,
    school TEXT,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS university_modules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    module_code TEXT NOT NULL,
    module_name TEXT NOT NULL,
    description TEXT,
    language TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (university_id, module_code),
    UNIQUE (id, university_id)
);

CREATE TABLE IF NOT EXISTS credit_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    smu_module_id BIGINT NOT NULL
        REFERENCES smu_modules(id) ON DELETE CASCADE,
    university_module_id BIGINT NOT NULL
        REFERENCES university_modules(id) ON DELETE CASCADE,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (smu_module_id, university_module_id)
);


-- 3. User Personalization & Planner
CREATE TABLE IF NOT EXISTS shortlists (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

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
    currency_code TEXT NOT NULL DEFAULT 'SGD' CHECK (char_length(currency_code) = 3),
    total_budget NUMERIC CHECK (total_budget >= 0),
    accommodation_budget NUMERIC CHECK (accommodation_budget >= 0),
    food_budget NUMERIC CHECK (food_budget >= 0),
    transport_budget NUMERIC CHECK (transport_budget >= 0),
    personal_budget NUMERIC CHECK (personal_budget >= 0),
    other_budget NUMERIC CHECK (other_budget >= 0),
    housing_type TEXT,
    food_option TEXT,
    transport_option TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, university_id),

    FOREIGN KEY (exchange_period_id, university_id)
        REFERENCES exchange_periods(id, university_id)
        ON DELETE SET NULL (exchange_period_id)
);

CREATE TABLE IF NOT EXISTS university_reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    exchange_period_id BIGINT,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    academics_rating SMALLINT CHECK (academics_rating BETWEEN 1 AND 5),
    accommodation_rating SMALLINT CHECK (accommodation_rating BETWEEN 1 AND 5),
    cost_rating SMALLINT CHECK (cost_rating BETWEEN 1 AND 5),
    campus_rating SMALLINT CHECK (campus_rating BETWEEN 1 AND 5),
    review TEXT CHECK (char_length(review) <= 2000),
    image_path TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, university_id),

    FOREIGN KEY (exchange_period_id, university_id)
        REFERENCES exchange_periods(id, university_id)
        ON DELETE SET NULL (exchange_period_id)
);

CREATE TABLE IF NOT EXISTS review_comments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    review_id BIGINT NOT NULL
        REFERENCES university_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timetables (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    exchange_period_id BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, university_id, exchange_period_id),
    UNIQUE (id, user_id, university_id),

    FOREIGN KEY (exchange_period_id, university_id)
        REFERENCES exchange_periods(id, university_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_modules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    university_module_id BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, university_id, university_module_id),
    UNIQUE (id, user_id, university_id),

    FOREIGN KEY (university_module_id, university_id)
        REFERENCES university_modules(id, university_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS planned_modules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timetable_id BIGINT NOT NULL,
    cart_module_id BIGINT NOT NULL,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id BIGINT NOT NULL
        REFERENCES universities(id) ON DELETE CASCADE,
    section TEXT,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location TEXT,
    session_type TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (timetable_id, cart_module_id),

    FOREIGN KEY (timetable_id, user_id, university_id)
        REFERENCES timetables(id, user_id, university_id)
        ON DELETE CASCADE,

    FOREIGN KEY (cart_module_id, user_id, university_id)
        REFERENCES cart_modules(id, user_id, university_id)
        ON DELETE CASCADE,

    CHECK (end_time > start_time)
);


-- INDEX
CREATE INDEX IF NOT EXISTS exchange_periods_university_id_idx ON exchange_periods(university_id);
CREATE INDEX IF NOT EXISTS credit_mappings_university_module_id_idx ON credit_mappings(university_module_id);
CREATE INDEX IF NOT EXISTS university_reviews_university_id_idx ON university_reviews(university_id);
CREATE INDEX IF NOT EXISTS review_comments_review_id_idx ON review_comments(review_id);
CREATE INDEX IF NOT EXISTS review_comments_user_id_idx ON review_comments(user_id);
CREATE INDEX IF NOT EXISTS planned_modules_timetable_id_idx ON planned_modules(timetable_id);
CREATE INDEX IF NOT EXISTS planned_modules_cart_module_id_idx ON planned_modules(cart_module_id);
CREATE INDEX IF NOT EXISTS planned_modules_user_id_idx ON planned_modules(user_id);
