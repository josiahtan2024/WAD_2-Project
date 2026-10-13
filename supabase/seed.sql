-- Real university seed data for SMUXchange
-- Region bands are SMU outgoing-exchange estimates in SGD.
-- Source: https://geo.smu.edu.sg/study-abroad/international-student-exchange-programme

INSERT INTO universities
    (name, country, city, region, lat, lng, currency_code,
     region_band_min, region_band_max)
VALUES
    ('Yonsei University', 'South Korea', 'Seoul',
     'Rest of Asia', 37.5665, 126.9388, 'KRW', 5000, 8000),

    ('Waseda University', 'Japan', 'Tokyo',
     'Rest of Asia', 35.7090, 139.7196, 'JPY', 5000, 8000),

    ('Australian National University', 'Australia', 'Canberra',
     'Oceania', -35.2777, 149.1205, 'AUD', 8000, 12000),

    ('Boston University', 'United States', 'Boston',
     'North America', 42.3505, -71.1054, 'USD', 10000, 16000),

    ('University of Warwick', 'United Kingdom', 'Coventry',
     'Europe', 52.3793, -1.5615, 'GBP', 8000, 12000),

    ('University of Amsterdam', 'Netherlands', 'Amsterdam',
     'Europe', 52.3555, 4.9557, 'EUR', 8000, 12000);

-- for cost and budgetting

INSERT INTO public.university_costs (
    university_id,
    category,
    amount_min,
    amount_max,
    currency_code,
    period,
    source_name,
    source_url,
    notes
)
SELECT
    u.id,
    v.category,
    v.amount_min,
    v.amount_max,
    v.currency_code,
    v.period,
    v.source_name,
    v.source_url,
    v.notes
FROM (
    VALUES
    (
        'Yonsei University',
        'living_expenses',
        337000::NUMERIC,
        605000::NUMERIC,
        'KRW',
        'monthly',
        'Yonsei University',
        'https://git.yonsei.ac.kr/git/courses/tuition.do',
        'Published monthly estimate; verify the exact expenses included.'
    ),
    (
        'Waseda University',
        'accommodation',
        54000::NUMERIC,
        63000::NUMERIC,
        'JPY',
        'monthly',
        'Waseda University',
        'https://www.waseda.jp/inst/rlc/en/student_dormitory/exchange/waseda-univerisity-student-house/',
        'Exchange student dormitory rent; utilities may be additional.'
    ),
    (
        'Australian National University',
        'living_expenses',
        24000::NUMERIC,
        28500::NUMERIC,
        'AUD',
        'annual',
        'Australian National University',
        'https://www.anu.edu.au/students/program-administration/fees-payments/estimated-cost-of-living-in-canberra',
        'Published February-November 2026 estimate; check the source for its exact period.'
    ),
    (
        'Boston University',
        'accommodation_food',
        20969::NUMERIC,
        20969::NUMERIC,
        'USD',
        'nine_months',
        'Boston University',
        'https://www.bu.edu/isso/international-students/required-financial-documentation/undergraduate-estimate-of-expenses/',
        'Room and board estimate for 9 months for 2026/2027; excludes tuition and other expenses.'
    ),
    (
        'University of Warwick',
        'accommodation',
        581.83::NUMERIC,
        712.83::NUMERIC,
        'GBP',
        'monthly',
        'University of Warwick',
        'https://warwick.ac.uk/students/life-at-warwick/living-off-campus/localareas/coventryandearlsdon/',
        'Published average rent range; accommodation only.'
    ),
    (
        'University of Amsterdam',
        'living_expenses',
        975::NUMERIC,
        1500::NUMERIC,
        'EUR',
        'monthly',
        'University of Amsterdam',
        'https://www.uva.nl/en/education/practical-information/living-in-amsterdam/living-expenses/living-expenses-uva.html',
        'Estimated monthly living expenses including rent; tuition excluded.'
    )
) AS v(
    university_name,
    category,
    amount_min,
    amount_max,
    currency_code,
    period,
    source_name,
    source_url,
    notes
)
JOIN public.universities u
    ON u.name = v.university_name
WHERE NOT EXISTS (
    SELECT 1
    FROM public.university_costs c
    WHERE c.university_id = u.id
      AND c.category = v.category
      AND c.source_name = v.source_name
);
