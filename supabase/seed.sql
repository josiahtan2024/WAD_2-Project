-- PLACEHOLDER DATA, NOT VERIFIED. AI-generated mock data: replace before the demo.
-- University names are fictional. Region bands must come from SMU's page for OUTGOING
-- exchange students. Cite the source in the README and slides.
insert into universities (name, country, city, region, lat, lng, currency_code, region_band_min, region_band_max) values
  ('Placeholder University Berlin',    'Germany',        'Berlin',      'Europe',        52.52,  13.405, 'EUR', 10000, 16000),
  ('Placeholder University Paris',     'France',         'Paris',       'Europe',        48.857,  2.352, 'EUR', 11000, 17000),
  ('Placeholder University Stockholm', 'Sweden',         'Stockholm',   'Europe',        59.329, 18.069, 'SEK', 11000, 17000),
  ('Placeholder University Tokyo',     'Japan',          'Tokyo',       'Asia',          35.68, 139.69,  'JPY',  8000, 13000),
  ('Placeholder University Seoul',     'South Korea',    'Seoul',       'Asia',          37.567, 126.978,'KRW',  7000, 12000),
  ('Placeholder University Boston',    'United States',  'Boston',      'North America', 42.36, -71.06,  'USD', 14000, 22000),
  ('Placeholder University Toronto',   'Canada',         'Toronto',     'North America', 43.653,-79.383, 'CAD', 12000, 19000),
  ('Placeholder University Sydney',    'Australia',      'Sydney',      'Oceania',      -33.869,151.209,'AUD', 12000, 18000);

insert into smu_modules (code, name) values
  ('IS100', 'Placeholder Module 1'),
  ('IS101', 'Placeholder Module 2'),
  ('IS102', 'Placeholder Module 3');

-- Placeholder mappings: every university maps all three modules to a made-up course.
insert into credit_mappings (university_id, smu_module_id, foreign_course_code, foreign_course_name, notes)
select u.id, m.id, 'XX-' || m.code, 'Placeholder equivalent of ' || m.name, 'Unverified placeholder'
from universities u cross join smu_modules m;
