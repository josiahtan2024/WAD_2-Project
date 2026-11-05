// Data every test starts from. It follows supabase/seed.sql (same names, regions and cost
// shapes), cut down so assertions stay readable. The numbers are fixed on purpose.

const stamp = '2026-01-01T00:00:00.000Z'

// [id, name, country, state, city, region, lat, long, timezone, currency, accommodation, food, transport, personal, languages]
const UNIVERSITIES = [
  [1, 'University of Pretoria', 'South Africa', 'Gauteng', 'Pretoria', 'Africa', -25.7558, 28.2308, 'UTC+2', 'ZAR', 9000, 5000, 1500, 3000, ['English']],
  [2, 'Boston University', 'United States', 'Massachusetts', 'Boston', 'Americas', 42.3505, -71.1054, 'UTC-5', 'USD', 1800, 800, 150, 500, ['English']],
  [3, 'University of Pennsylvania', 'United States', 'Pennsylvania', 'Philadelphia', 'Americas', 39.9523, -75.1937, 'UTC-5', 'USD', 1900, 800, 120, 550, ['English']],
  [4, 'Yonsei University', 'South Korea', 'Seoul', 'Seoul', 'Asia', 37.5671, 126.939, 'UTC+9', 'KRW', 800000, 500000, 100000, 400000, ['Korean', 'English']],
  [5, 'Kyoto University', 'Japan', 'Kyoto', 'Kyoto', 'Asia', 35.0268, 135.7808, 'UTC+9', 'JPY', 65000, 45000, 10000, 25000, ['Japanese', 'English']],
  [6, 'Fudan University', 'China', 'Shanghai', 'Shanghai', 'Asia', 31.2977, 121.5035, 'UTC+8', 'CNY', 3500, 2200, 400, 1400, ['Mandarin', 'English']],
  [7, 'University College London', 'United Kingdom', 'England', 'London', 'Europe', 51.5246, -0.134, 'UTC+0', 'GBP', 1350, 550, 220, 550, ['English']],
  [8, 'University of Zurich', 'Switzerland', 'Zurich', 'Zurich', 'Europe', 47.3749, 8.5481, 'UTC+1', 'CHF', 1000, 600, 100, 500, ['German', 'English']],
  [9, 'Koc University', 'Turkey', 'Istanbul', 'Istanbul', 'Middle-East', 41.205, 29.07, 'UTC+3', 'TRY', 25000, 12000, 3000, 6000, ['English']],
  [10, 'University of New South Wales', 'Australia', 'New South Wales', 'Sydney', 'Oceania', -33.9173, 151.2253, 'UTC+10', 'AUD', 1600, 600, 200, 500, ['English']],
  [11, 'University of Melbourne', 'Australia', 'Victoria', 'Melbourne', 'Oceania', -37.7963, 144.9614, 'UTC+10', 'AUD', 2100, 500, 180, 400, ['English']],
  [12, 'Technical University of Munich', 'Germany', 'Bavaria', 'Munich', 'Europe', 48.1497, 11.5679, 'UTC+1', 'EUR', 1000, 350, 49, 300, ['German', 'English']],
  [13, "King's College London", 'United Kingdom', 'England', 'London', 'Europe', 51.5115, -0.116, 'UTC+0', 'GBP', 1164, 167, 173, 266, ['English']],
  [14, 'University of Toronto', 'Canada', 'Ontario', 'Toronto', 'Americas', 43.6629, -79.3957, 'UTC-5', 'CAD', 1800, 400, 130, 300, ['English']],
]

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** What 1 SGD buys, as Frankfurter reports it. */
export const RATES = { USD: 0.78, EUR: 0.67, GBP: 0.58, JPY: 117, KRW: 1075, AUD: 1.19, CAD: 1.07, CHF: 0.62, CNY: 5.6, HKD: 6.1, ZAR: 14, TRY: 33 }

const SMU_MODULES = [
  [1, 'XBBM903', 'Lee Kong Chian School of Business', 'Finance Major Elective'],
  [2, 'XBBM906', 'Lee Kong Chian School of Business', 'Marketing Major Elective'],
  [3, 'XECO900', 'School of Economics', 'Economics Major Elective'],
  [4, 'XISM927', 'School of Computing and Information Systems', 'IS Depth Elective'],
  [5, 'XSSC902', 'School of Social Sciences', 'Political Science Major Elective'],
  [6, 'XSSC903', 'School of Social Sciences', 'Psychology Major Elective'],
  [7, 'XLLB900', 'Yong Pung How School of Law', 'Law Major Elective - LLB/JD only'],
  [8, 'XCC900', 'Core Curriculum', 'Capabilities - Managing'],
  [9, 'XACC900', 'School of Accountancy', 'Accounting Elective'],
  [10, 'XFE902', 'School of Social Sciences', 'Free Electives (SOSS)'],
]

// Modules per university: [code, name, language, SMU course area id]. Boston has 12 so the
// "no more than 10 per university" cart rule can be hit; Koc has none mapped on purpose.
const MODULES = {
  1: [['PSY 310', 'Developmental Psychology', 'English', 6], ['BEM 311', 'Marketing Management', 'English', 2], ['IRG 220', 'International Relations', 'English', 5], ['FIL 320', 'Philosophy of Religion', 'English', 10]],
  2: [
    ['CAS EC 403', 'Game Theory', 'English', 3], ['CAS EC 356', 'Economics of the Labor Market', 'English', 3], ['CAS EC 322', 'Money and Financial Markets', 'English', 3],
    ['QST FE 445', 'International Financial Management', 'English', 1], ['QST FE 448', 'Business Valuation', 'English', 1], ['QST FE 430', 'Derivatives Securities', 'English', 1],
    ['QST MK 420', 'Digital Marketing Analytics', 'English', 2], ['QST MK 467', 'International Marketing', 'English', 2], ['CAS IR 360', 'Immigration and Development in Asia', 'English', 5],
    ['CAS PH 150', 'Great Philosophers', 'English', 10], ['CAS CS 591', 'Blockchains and Their Applications', 'English', 4], ['CAS IS 223', 'Introduction to Information Systems', 'English', 4],
  ],
  3: [['MATH 1400', 'Linear Algebra', 'English', 10], ['PSYC 1462', 'Abnormal Psychology', 'English', 6], ['POLS 2600', 'International Security', 'English', 5]],
  4: [['ECO3100', 'International Economics', 'English', 3], ['UDS1101', 'Introduction to International Studies', 'English', 5], ['KOR1103', 'Basic Korean I', 'Korean', 10], ['IEE3102', 'Introduction to Artificial Intelligence', 'English', 4]],
  5: [['ECON200', 'Microeconomics', 'English', 3], ['JPN100', 'Elementary Japanese', 'Japanese', 10]],
  6: [['FINC120005', 'Corporate Finance', 'English', 1], ['ECON120014', 'Political Economy of China', 'English', 3], ['LANG120046', 'Basic Korean Language', 'English', 10]],
  7: [['BASC0003', 'Business Analytics', 'English', 4], ['COMP0005', 'Principles of Programming', 'English', 4], ['POLI0035', 'British Politics', 'English', 5], ['PSYC0002', 'Behaviour Change', 'English', 6]],
  8: [['ECON1002', 'Intermediate Econometrics', 'English', 3], ['FINA1016', 'Corporate Finance (L)', 'English', 1], ['LAWS1099', 'International Finance Law', 'English', 7]],
  9: [['ECON 201', 'Tracking the Turkish Economy', 'English', null], ['PSYC 207', 'Social Psychology', 'English', null]],
  10: [['COMM1009', 'Asia-Pacific Business', 'English', 8], ['LAWS1005', 'Public International Law', 'English', 7], ['PSYC1007', 'Perception and Cognition', 'English', 6]],
  11: [['FNCE30003', 'International Finance', 'English', 1], ['ECON20005', 'Competition and Strategy', 'English', 3]],
  12: [['IN2001', 'Algorithms and Data Structures', 'English', 4], ['MGT101', 'Introduction to Management', 'English', 8]],
  13: [['6SSMN301', 'Behavioural Finance', 'English', 1], ['6LAA0001', 'Public International Law', 'English', 7]],
  14: [['ECO200', 'Microeconomic Theory', 'English', 3], ['ROT101', 'Rotman Commerce Intro', 'English', 8]],
}

export function buildSeed() {
  const universities = []
  const costs = []
  const languages = []
  const periods = []
  const modules = []
  const mappings = []

  let languageId = 1
  let periodId = 1
  let moduleId = 1
  let mappingId = 1

  for (const [id, name, country, state, city, region, lat, long, timezone, currency, accommodation, food, transport, personal, langs] of UNIVERSITIES) {
    universities.push({
      id, name, country, state, city, region, lat, long, timezone,
      website_url: `https://www.${slug(name)}.example.edu/`,
      modules_url: `https://www.${slug(name)}.example.edu/courses`,
      logo_url: `university-logos/${slug(name)}-logo.webp`,
      description: `${name} is a partner university in ${city}, ${country}.`,
      published: true, created_at: stamp, updated_at: stamp,
    })
    costs.push({ id, university_id: id, currency_code: currency, accommodation, food, transport, personal_expenses: personal, other_expenses: null, created_at: stamp, updated_at: stamp })
    for (const instruction_language of langs) languages.push({ id: languageId++, university_id: id, instruction_language, created_at: stamp })
    periods.push(
      { id: periodId++, university_id: id, period_name: 'Fall 2026', term: '1', academic_year: '2026/2027', start_date: '2026-09-02', end_date: '2026-12-18', min_temperature: 2, max_temperature: 22, description: 'Cool to chilly', created_at: stamp, updated_at: stamp },
      { id: periodId++, university_id: id, period_name: 'Spring 2027', term: '2', academic_year: '2026/2027', start_date: '2027-01-19', end_date: '2027-05-07', min_temperature: -3, max_temperature: 18, description: 'Cold to mild', created_at: stamp, updated_at: stamp },
    )
    for (const [module_code, module_name, language, smuId] of MODULES[id] ?? []) {
      const thisModule = moduleId++
      modules.push({ id: thisModule, university_id: id, module_code, module_name, description: null, language, created_at: stamp, updated_at: stamp })
      if (smuId) mappings.push({ id: mappingId++, smu_module_id: smuId, university_module_id: thisModule, notes: null, created_at: stamp, updated_at: stamp })
    }
  }

  // A hidden university with nothing filled in yet, for the staff view
  universities.push({
    id: 15, name: 'Atlantis Institute', country: 'Atlantis', state: null, city: 'Poseidonis', region: 'Oceania', lat: null, long: null, timezone: null,
    website_url: null, modules_url: null, logo_url: null, description: null, published: false, created_at: stamp, updated_at: stamp,
  })

  const users = [
    { id: '00000000-0000-4000-8000-0000000000a1', email: 'alex@seed.test', password: 'seed-password-1', app_metadata: {}, confirmed: true },
    { id: '00000000-0000-4000-8000-0000000000b2', email: 'bea@seed.test', password: 'seed-password-2', app_metadata: {}, confirmed: true },
  ]
  const [alex, bea] = users

  const reviews = [
    { id: 1, user_id: alex.id, university_id: 7, exchange_period_id: null, rating: 5, academics_rating: 4, accommodation_rating: null, cost_rating: 2, campus_rating: 5, review: 'London was incredible. Classes were demanding but the city makes up for it.', image_path: null, created_at: '2026-03-01T10:00:00.000Z', updated_at: '2026-03-01T10:00:00.000Z' },
    { id: 2, user_id: bea.id, university_id: 7, exchange_period_id: null, rating: 3, academics_rating: null, accommodation_rating: 2, cost_rating: null, campus_rating: null, review: 'Good semester, but housing was expensive and far from campus.', image_path: null, created_at: '2026-03-05T10:00:00.000Z', updated_at: '2026-03-05T10:00:00.000Z' },
  ]
  const comments = [
    { id: 1, review_id: 1, user_id: bea.id, body: 'Which hall did you stay in?', created_at: '2026-03-02T10:00:00.000Z', updated_at: '2026-03-02T10:00:00.000Z' },
  ]

  return {
    users,
    tables: {
      universities, university_costs: costs, university_languages: languages, exchange_periods: periods,
      smu_modules: SMU_MODULES.map(([id, course_area, school, description]) => ({ id, course_area, school, description, created_at: stamp, updated_at: stamp })),
      university_modules: modules, credit_mappings: mappings,
      university_reviews: reviews, review_comments: comments,
      shortlists: [], user_budgets: [], timetables: [], cart_modules: [], planned_modules: [],
    },
  }
}

export const SEEDED = { alex: 'alex@seed.test', bea: 'bea@seed.test' }

/** Monthly cost in SGD for a seeded university, the way the app works it out. */
export function monthlyCostSgd(universityId) {
  const { tables } = buildSeed()
  const cost = tables.university_costs.find((c) => c.university_id === universityId)
  const total = cost.accommodation + cost.food + cost.transport + cost.personal_expenses
  return total / RATES[cost.currency_code]
}

export const VISIBLE_UNIVERSITIES = UNIVERSITIES.map(([id, name, country, , city, region]) => ({ id, name, country, city, region }))

/** Great-circle distance from SMU (Singapore), rounded to whole kilometres, as the detail page shows it. */
export function distanceFromSmu(lat, long) {
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const lat1 = toRad(1.29627)
  const lat2 = toRad(lat)
  const dLat = lat2 - lat1
  const dLon = toRad(long - 103.85185)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export const universityNamed = (name) => buildSeed().tables.universities.find((u) => u.name === name)
