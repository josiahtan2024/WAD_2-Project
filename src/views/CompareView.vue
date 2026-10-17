<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import axios from 'axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase, STORAGE_URL } from '@/lib/supabase'
import CompareRow from '@/components/CompareRow.vue'
import CompareRowHeader from '@/components/CompareRowHeader.vue'

const universities = ref([])
const isLoading = ref(true)

async function fetchUniversities() {
    isLoading.value = true
    try {
        const { data, error } = await supabase
            .from('universities')
            .select(`
                *,
                university_languages ( instruction_language ),
                exchange_periods ( * ),
                university_costs ( * ),
                university_modules ( count )
            `)

        if (error) throw error

        universities.value = data.map(uni => {
            const primaryPeriod = uni.exchange_periods?.[0] || {}
            const languages = uni.university_languages?.map(l => l.instruction_language).join(', ') || 'N/A'
            const cost = uni.university_costs?.[0] || uni.university_costs || {}
            const modulesCount = uni.university_modules?.[0]?.count || 0

            let logoURL = ''
            if (uni.logo_url) {
                logoURL = uni.logo_url.startsWith('http') 
                    ? uni.logo_url 
                    : `${STORAGE_URL}/${uni.logo_url}`
            }

            return {
                id: uni.id,
                name: uni.name,
                logo: logoURL,
                website: uni.website_url,
                location: {
                    city: uni.city,
                    state: uni.state,
                    country: uni.country,
                    region: uni.region,
                    timezone: uni.timezone,
                    coordinates: {
                        lat: uni.lat,
                        lon: uni.long
                    }
                },
                cost: {
                    currency: cost.currency_code || 'USD',
                    total: (Number(cost.accommodation) || 0) +
                            (Number(cost.food) || 0) +
                            (Number(cost.transport) || 0) + 
                            (Number(cost.personal_expenses) || 0),
                    accommodation: cost.accommodation ? Number(cost.accommodation) : null,
                    food: cost.food ? Number(cost.food) : null,
                    transport: cost.transport ? Number(cost.transport) : null,
                    personalExpenses: cost.personal_expenses ? Number(cost.personal_expenses) : null
                },
                academic: {
                    modulesOffered: modulesCount,
                    language: languages,
                    modulesURL: uni.modules_url
                },
                exchange: {
                    name: primaryPeriod.period_name || 'N/A',
                    startDate: primaryPeriod.start_date || 'N/A',
                    endDate: primaryPeriod.end_date || 'N/A'
                },
                climate: {
                    minTemp: primaryPeriod.min_temperature ?? '-',
                    maxTemp: primaryPeriod.max_temperature ?? '-',
                    description: primaryPeriod.description || 'N/A'
                }
            }
        })
    } catch (err) {
        console.error('Error fetching universities from Supabase:', err.message)
    } finally {
        isLoading.value = false
    }
}

// SessionStorage Shortlist state initialization (Default to [3, 6] if empty)
const SESSION_STORAGE_KEY = 'smu_geo_shortlisted_unis'

const getStoredShortlists = () => {
    const data = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (data) {
        try {
            return JSON.parse(data)
        } catch (e) {
            console.error('Failed to parse sessionstorage shortlist', e)
        }
    }
    // Default initial state
    const initial = [3, 6]
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(initial))
    return initial
}

const shortlistedIds = ref(getStoredShortlists())

// Helper to check if a uni is shortlisted
const isShortlisted = (uniId) => {
    return shortlistedIds.value.includes(uniId)
}

// Toggle shortlist add/remove
const toggleShortlist = (uniId) => {
    if (isShortlisted(uniId)) {
        shortlistedIds.value = shortlistedIds.value.filter(id => id !== uniId)
    } else {
        shortlistedIds.value.push(uniId)
    }
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(shortlistedIds.value))
}
// Lines 11-45 to be removed - temp solution for shortlisting demo

const shortlistedUnis = computed(() => {
    return universities.value.filter(uni => shortlistedIds.value.includes(uni.id))
})

const remainingUnis = computed(() => {
    return universities.value.filter(uni => !shortlistedIds.value.includes(uni.id))
})

// TO-DO: Slot1 from Query(or pass in hidden payload)
const uniSlots = ref([
    // universities.value[0]?.id || 
    null,
    null,
    null
])

const uniCurrencies = ref(['home', 'home', 'home'])

// Comparision Data
const unisToCompare = computed (() => {
    return uniSlots.value.map(id => {
        return universities.value.find(uni => uni.id === id) || null })
})

const selectRefs = ref([]);
const openDropdown = (idx) => {
    const selectEl = selectRefs.value[idx];
    if (selectEl) {
        // showPicker() opens the native dropdown immediately on click
        if (typeof selectEl.showPicker === 'function') {
            selectEl.showPicker();
        } else {
            // Fallback for older browsers
            selectEl.focus();
        }
    }
};

// Uni Selection Helper
function selectUniversity(slotIndex, uniId) {
    const oldUniId = uniSlots.value[slotIndex]

    if (uniId === null) {
        uniSlots.value[slotIndex] = null
        // Flush universities to the left
        uniSlots.value = [
            ...uniSlots.value.filter(id => id !== null),
            ...Array(uniSlots.value.filter(id => id === null).length).fill(null)
        ]
        return
    }

    // If the user selected the same university, do nothing
    if (oldUniId === uniId) {
        return
    }

    // Find whether this university is already in another slot
    const existingSlotIndex = uniSlots.value.findIndex(
        (id, index) => index !== slotIndex && id === uniId
    )

    if (existingSlotIndex !== -1) {
        // Swap if both slots occupied
        if (oldUniId !== null) {
            uniSlots.value[slotIndex] = uniId
            uniSlots.value[existingSlotIndex] = oldUniId      
        }
    } else if (oldUniId === null) {
        // Put university into leftmost empty slot
        const firstEmptyIndex = uniSlots.value.findIndex(id => id === null)

        if (firstEmptyIndex !== -1) {
            uniSlots.value[firstEmptyIndex] = uniId
        }
    } else {
        // Normal selection
        uniSlots.value[slotIndex] = uniId
    }
}

// Location Helper
function formatLocation(location) {
    const { city, state, country } = location
    if (city === state && state === country) {
        return country
    }
    if (city === state || state === country) {
        return `${city}, ${country}`
    }
    return `${city}, ${state}, ${country}`
}

function distanceFromSMU(coordinates) {
    if (!coordinates?.lat || !coordinates?.lon) return '-'
    // Haversine Formula
    const lat1 = 1.29627
    const lon1 = 103.85185
    const lat2 = coordinates.lat
    const lon2 = coordinates.lon
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c); // Returns clean, rounded distance (e.g., 11050 km)
}

// Cost/Currency Helpers
function formatCurrency(value, currency) {
    if (value === null || value === undefined) {
        return '-'
    }
    
    return value.toLocaleString('en-SG', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0
    })
}

function formatCost(value, homeCurrency, idx) {
    if (value === null || value === undefined) {
        return '-'
    }

    // Check if user selected SGD
    const showSGD = uniCurrencies.value[idx] === 'SGD'
    if (showSGD && homeCurrency !== 'SGD') {
        const rate = ratesMap.value[homeCurrency]
        // Convert to SGD if rate exists, otherwise default to home currency
        return rate ? formatCurrency(value / rate, 'SGD') : formatCurrency(value, homeCurrency)
    }

    return formatCurrency(value, homeCurrency)
}

//  Exchange Helper
function formatExchangeDate(dateStr) {
    if (dateStr === null || dateStr === 'N/A') return 'N/A'

    const [year, month, day] = dateStr.split('-')
    if (!year || !month || !day) return dateStr

    const date = new Date(year, month - 1, day)
    
    return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
    }) // Output: "Jan 2027"
}

// Maps - Leaflet API
// TO-DO: Implement Google Maps API for better visuals
const maps = ref([])
const mapElements = ref([])
async function createMap(idx) {
    await nextTick()

    const uni = unisToCompare.value[idx]
    const element = mapElements.value[idx]

    // Remove previous map at slot
    if (maps.value[idx]) {
        maps.value[idx].remove()
        maps.value[idx] = null
    }

    // No uni selected
    if (!uni || !element || !uni.location.coordinates.lat) {
        return
    }

    const { lat, lon } = uni.location.coordinates

    const map = L.map(element, {
        scrollWheelZoom: false
    }).setView([lat, lon], 13)

    map.on('click', () => {
        const googleMapsUrl =
            `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`

        window.open(googleMapsUrl, '_blank', 'noopener,noreferrer')
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)

    L.marker([lat, lon]).addTo(map).bindPopup(uni.name)

    maps.value[idx] = map

    requestAnimationFrame(() => {
        map.invalidateSize()
    })
}

// FX Rates - Frankfurter API
const currencyRates = ref([])
async function fetchCurrencyRates() {
    const url = "https://api.frankfurter.dev/v2/rates?base=sgd"
    try {
        const response = await axios.get(url)
        const data = response.data.map(({base, ...rest}) => rest)
        currencyRates.value = data
        // console.log(data)
    } catch (error) {
        console.error(error.message)
    }
}

const ratesMap = computed(() => {
    return currencyRates.value.reduce((map, item) => {
        map[item.quote] = item.rate
        return map
    }, {})
})

// Lifecycle
onMounted(async () => {
    await fetchUniversities()
    unisToCompare.value.forEach((uni, idx) => createMap(idx))
    fetchCurrencyRates()
})

watch(
    () => [...uniSlots.value],
    (newSlots, oldSlots) => {
        newSlots.forEach((slot, idx) => {
            if (slot !== oldSlots[idx]) {
                uniCurrencies.value[idx] = 'home'
                createMap(idx)
            }
        })
    }
)
</script>

<template>
    <!-- min-vh-100 sets minimum height to full screen
    d-flex and flex-column turns it into vertical layout -->
    <div class="container-fluid min-vh-100 d-flex flex-column p-0">
    <!-- flex-grow-1 forces main element to expand and push footer to absolute bottom -->
    <main class="flex-grow-1">
        <section class="text-center py-3 my-5">
            <div class="container-fluid">
                <h1 class="display-3 fw-semibold">Compare Universities</h1>
                <p class="fs-5">SMU Global Experience</p>
                <p class="fs-5"><a href="https://geo.smu.edu.sg/" class="link-primary text-decoration-none custom-hover-link" 
                    target="_blank" rel="noopener noreferrer">Learn more about SMU GEO<i class="bi bi-chevron-right fs-6 ms-1"></i></a></p>
            </div>
        </section>

        <section class="container pb-5 mb-5">

                <!-- Uni Selector -->
                <CompareRow :unis-to-compare="unisToCompare" special-row-class="sticky-uni-selector"
                special-vfor-class="text-center d-flex flex-column" :render-dropdown="true">
                    <template #default="{ uni, idx }">
                        <select :value="uniSlots[idx]" :ref="el => selectRefs[idx] = el"
                        @change="selectUniversity(idx, $event.target.value === '' ? null : Number($event.target.value)); $event.target.blur()" 
                        class="form-select fs-5 fw-semibold py-3 ps-3 custom-select-blue">
                            <option value="">Choose a university</option>
                            <!-- <option v-for="uni in universities" :key="uni.id" :value="uni.id"
                            :disabled="uniSlots[idx] === null && uniSlots.some((id, i) => i !== idx && id === uni.id)">{{ uni.name }}</option> -->
                            <!-- TO-DO: Grouping TODO -->
                            <optgroup label="My Shortlist" v-if="shortlistedUnis.length > 0">
                                <option v-for="uni in shortlistedUnis" :key="uni.id" :value="uni.id"
                                :disabled="uniSlots[idx] === null && uniSlots.some((id, i) => i !== idx && id === uni.id)">{{ uni.name }}</option>
                            </optgroup>
                            <optgroup label="Other Universities" v-if="remainingUnis.length > 0">
                                <option v-for="uni in remainingUnis" :key="uni.id" :value="uni.id"
                                :disabled="uniSlots[idx] === null && uniSlots.some((id, i) => i !== idx && id === uni.id)">{{ uni.name }}</option>
                            </optgroup>
                        </select>
                    </template>
                </CompareRow>

                <!-- Uni Info -->
                <CompareRow :unis-to-compare="unisToCompare" special-vfor-class="text-center d-flex flex-column"
                special-vif-class="d-flex flex-column flex-grow-1">
                    <template #default="{ uni, idx }">
                        <div class="uni-logo d-flex align-items-center justify-content-center overflow-hidden">
                            <img :src="uni.logo" class="img-fluid">
                        </div>
                    </template>
                    <template #empty="{ idx }">
                        <div class="uni-logo d-flex align-items-center justify-content-center text-secondary flex-column"
                        @click="openDropdown(idx)" role="button" style="cursor: pointer;">
                            <div class="fs-3 fw-light">+</div>
                            <span>Choose a university</span>
                        </div>
                    </template>            
                </CompareRow>

                <CompareRow :unis-to-compare="unisToCompare" special-vfor-class="text-center d-flex flex-column"
                special-vif-class="d-flex flex-column flex-grow-1">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary my-3 d-flex align-items-center justify-content-center h-100 text-break">
                            {{ uni.location.country }}
                        </div>
                    </template>
                </CompareRow>


                <CompareRow :unis-to-compare="unisToCompare" special-vfor-class="text-center d-flex flex-column"
                special-vif-class="d-flex flex-column flex-grow-1">
                    <template #default="{ uni, idx }">
                        <div class="border-top pt-3">
                            <button class="btn rounded-pill px-3" :class="isShortlisted(uni.id) ? 'btn-success' : 'btn-primary'" @click="toggleShortlist(uni.id)">
                                {{ isShortlisted(uni.id) ? 'Shortlisted' : 'Shortlist' }}
                            </button>
                        </div>
                        <div class="pt-3">
                            <a :href="uni.website" class="link-primary text-decoration-none custom-hover-link" 
                            target="_blank" rel="noopener noreferrer">Visit Website<i class="bi bi-chevron-right ms-1" style="font-size: 12px;"></i></a>
                        </div>
                    </template>
                </CompareRow>

                <!-- Location -->
                <CompareRowHeader :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        Location
                    </template>
                </CompareRowHeader>

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div :ref="el => mapElements[idx] = el" class="uni-map mt-3">
                        </div>
                    </template>
                </CompareRow>   

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small pt-3">
                            Location
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break">
                            {{ formatLocation(uni.location) }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Region
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break">
                            {{ uni.location.region }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Timezone
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break">
                            {{ uni.location.timezone }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Distance from SG
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break">
                            {{ distanceFromSMU(uni.location.coordinates) }} km
                        </div>
                    </template>
                </CompareRow>  

                <!-- Cost -->
                <CompareRowHeader :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        Cost
                    </template>
                </CompareRowHeader>

                <CompareRow :unis-to-compare="unisToCompare"  special-vif-class="h-100">
                    <template #default="{ uni, idx }">
                        <div class="d-flex flex-column flex-md-row justify-content-between align-items-center h-100 gap-3 pt-3">
                            <div class="text-break text-center text-md-start text-secondary fw-semibold">
                                1 SGD = {{ ratesMap[uni.cost.currency] || '—'}} {{ uni.cost.currency }}
                            </div>
                            <div class="btn-group btn-group-sm">
                                <button class="btn" :class="uniCurrencies[idx] === 'home' ? 'btn-primary' : 'btn-outline-primary'"
                                @click="uniCurrencies[idx] = 'home'">{{ uni.cost.currency }}</button>
                                <button class="btn" :class="uniCurrencies[idx] === 'SGD' ? 'btn-primary' : 'btn-outline-primary'"
                                @click="uniCurrencies[idx] = 'SGD'">SGD</button>
                            </div>
                        </div> 
                    </template>
                </CompareRow>                

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small pt-3">
                            Estimated Monthly Total
                        </div>
                    </template>
                </CompareRow>    

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break fw-bold fs-4">
                            {{ formatCost(uni.cost.total, uni.cost.currency, idx) }}
                        </div>
                    </template>
                </CompareRow>    

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Accommodation
                        </div>
                    </template>
                </CompareRow>    

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break">
                            {{ formatCost(uni.cost.accommodation, uni.cost.currency, idx) }}
                        </div>
                    </template>
                </CompareRow>    

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Food
                        </div>
                    </template>
                </CompareRow>   

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break">
                            {{ formatCost(uni.cost.food, uni.cost.currency, idx) }}
                        </div>
                    </template>
                </CompareRow>   

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Transport
                        </div>
                    </template>
                </CompareRow>   

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break">
                            {{ formatCost(uni.cost.transport, uni.cost.currency, idx) }}
                        </div>
                    </template>
                </CompareRow>   

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Personal Expenses
                        </div>
                    </template>
                </CompareRow>   

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break">
                            {{ formatCost(uni.cost.personalExpenses, uni.cost.currency, idx) }}
                        </div>
                    </template>
                </CompareRow>   

                <!-- Academics -->
                <CompareRowHeader :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        Academics
                    </template>
                </CompareRowHeader>

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small pt-3">
                            Mapped Modules
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break fw-bold fs-4">
                            {{  uni.academic.modulesOffered }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Language
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="text-break">
                            {{ uni.academic.language }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div class="mt-3 pt-3 border-top">
                            <a :href="uni.academic.modulesURL" class="link-primary text-decoration-none custom-hover-link" 
                                target="_blank" rel="noopener noreferrer">View Course Catalogue<i class="bi bi-chevron-right ms-1" style="font-size: 12px;"></i></a>
                        </div>
                    </template>
                </CompareRow>
                
                <!-- Exchange -->
                <CompareRowHeader :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        Exchange Programme
                    </template>
                </CompareRowHeader>
                <!-- TODO FIGURE OUT HOW TO DISPLAY DYNAMIC LIST OF PROGRAMME PER UNI -->
                <div class="row justify-content-center">
                    <div v-for="(uni, idx) in unisToCompare" :key="idx" 
                    class="col-6 col-lg-4" 
                    :class="{'d-none d-lg-block': idx === 2}">
                        <div v-if="uni">
                            <div class="text-secondary small pt-3">
                                Programme
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div v-for="(uni, idx) in unisToCompare" :key="idx" 
                    class="col-6 col-lg-4" 
                    :class="{'d-none d-lg-block': idx === 2}">
                        <div v-if="uni">
                            <div class="text-break fw-bold fs-4">
                                {{  uni.exchange.name }}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row justify-content-center">
                    <div v-for="(uni, idx) in unisToCompare" :key="idx" 
                    class="col-6 col-lg-4" 
                    :class="{'d-none d-lg-block': idx === 2}">
                        <div v-if="uni">
                            <div class="text-secondary small mt-3 pt-3 border-top">
                                Exchange Period
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div v-for="(uni, idx) in unisToCompare" :key="idx" 
                    class="col-6 col-lg-4" 
                    :class="{'d-none d-lg-block': idx === 2}">
                        <div v-if="uni">
                            <div class="text-break">
                                {{ formatExchangeDate(uni.exchange.startDate) }} - {{ formatExchangeDate(uni.exchange.endDate) }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Climate -->
                <CompareRowHeader :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        Climate
                    </template>
                </CompareRowHeader>

                <div class="row justify-content-center">
                    <div v-for="(uni, idx) in unisToCompare" :key="idx" 
                    class="col-6 col-lg-4" 
                    :class="{'d-none d-lg-block': idx === 2}">
                        <div v-if="uni">
                            <div class="text-secondary small pt-3">
                                Temperature
                            </div>
                        </div>
                    </div>
                </div> 

                <div class="row justify-content-center">
                    <div v-for="(uni, idx) in unisToCompare" :key="idx" 
                    class="col-6 col-lg-4" 
                    :class="{'d-none d-lg-block': idx === 2}">
                        <div v-if="uni">
                            <div class="text-break fw-bold fs-4">
                                {{ uni.climate.minTemp }} - {{ uni.climate.maxTemp }} °C
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div v-for="(uni, idx) in unisToCompare" :key="idx" 
                    class="col-6 col-lg-4" 
                    :class="{'d-none d-lg-block': idx === 2}">
                        <div v-if="uni">
                            <div class="text-secondary small mt-3 pt-3 border-top">
                                Overview
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div v-for="(uni, idx) in unisToCompare" :key="idx" 
                    class="col-6 col-lg-4" 
                    :class="{'d-none d-lg-block': idx === 2}">
                        <div v-if="uni">
                            <div class="text-break">
                                {{ uni.climate.description }}
                            </div>
                        </div>
                    </div>
                </div>

        </section>
    </main>
  </div>
</template>

<style scoped>
header, footer {
    background-color: #181e4a;
    color: #ffffff;
    text-align: center;
}
.uni-logo {
    height: 200px;
    width: 100%;
    margin-top: 4px;
}
.uni-logo img {
    display: block;
    height: 200px;
    width: 200px;
    max-width: 200px;
    max-height: 200px;
    object-fit: contain;
    margin: 0 auto;
}
.uni-map {
    width: 100%;
    height: 200px;
    border-radius: 10px;
    overflow: hidden;
}
.custom-hover-link:hover {
    text-decoration: underline !important;
}
.form-select:hover {
    outline: 1px solid black;
}
.sticky-uni-selector {
    position: sticky;
    top: 0;
    z-index: 1030;
    background-color: white;
    padding-top: 12px;
    padding-bottom: 12px;
}
.custom-select-blue {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%230d6efd' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3E%3C/svg%3E") !important;
}
/* md breakpoint - tablet */
@media (max-width: 991.98px) {
    .uni-logo {
        height: 150px;
    }

    .uni-logo img {
        width: 150px;
        height: 150px;
        max-width: 100%;
        max-height: 100%;
    }

    .uni-map {
        height: 150px;
    }
}
/* below md breakpoint - bottom border only */
@media (max-width: 767.98px) {
    .form-select {
        border: none;
        border-bottom: 1px solid var(--bs-border-color);
        border-radius: 0;
        padding-left: 0 !important;
        outline: none;
    }

    .form-select:hover {
        outline: none;
        border-bottom: 1px solid black;
    }

    .form-select:focus {
        border: 1px solid transparent !important;
        border-bottom: 1px solid black !important;
        border-radius: 0.375rem !important;
    }

    .uni-logo {
        height: 120px;
    }

    .uni-logo img {
        width: 120px;
        height: 120px;
        max-width: 100%;
        max-height: 100%;
    }

    .uni-map {
        height: 130px;
    }

    .sticky-uni-selector {
        padding-top: 4px !important;
        padding-bottom: 4px !important;
    }
}
/* xs breakpoint - mobile */
@media (max-width: 575.98px) {
    .uni-logo {
        height: 100px;
    }

    .uni-logo img {
        width: 100px;
        height: 100px;
        max-width: 100%;
        max-height: 100%;
    }

    .uni-map {
        height: 120px;
    }

    .sticky-uni-selector {
        padding-top: 4px !important;
        padding-bottom: 4px !important;
    }
}
</style>
