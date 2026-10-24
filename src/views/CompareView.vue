<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { supabase, STORAGE_URL } from '@/lib/supabase'
import axios from 'axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import CompareRow from '@/components/CompareRow.vue'
import CompareRowHeader from '@/components/CompareRowHeader.vue'

const router = useRouter()
const auth = useAuthStore()

// TODO TO-DO FIX SCALING AND RESPONSIVE UI
// Universities
const universities = ref([])
const uniIsLoading = ref(true)
async function fetchUniversities() {
    uniIsLoading.value = true
    try {
        const { data, error } = await supabase
            .from('universities')
            .select(`
                *,
                university_languages ( instruction_language ),
                university_costs ( * ),
                university_modules ( * ),
                exchange_periods ( * )
            `)

        if (error) throw error

        universities.value = data.map(uni => {
            const languages = uni.university_languages?.map(l => l.instruction_language).join(', ') || '-'
            const cost = uni.university_costs || {}
            const modulesCount = uni.university_modules?.length || 0

            const accom = Number(cost.accommodation || 0)
            const food = Number(cost.food || 0)
            const transport = Number(cost.transport || 0)
            const personal = Number(cost.personal_expenses || 0)
            const total = accom + food + transport + personal

            const periods = (uni.exchange_periods || []).map(period => ({
                id: period.id,
                periodName: period.period_name || '-',
                term: period.term || '-',
                academicYear: period.academic_year || '-',
                startDate: period.start_date || '-',
                endDate: period.end_date || '-',
                minTemp: period.min_temperature ?? '-',
                maxTemp: period.max_temperature ?? '-',
                description: period.description || '-'
            })).sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

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
                    total: total,
                    accommodation: accom,
                    food: food,
                    transport: transport,
                    personalExpenses: personal
                },
                academic: {
                    mappedModules: modulesCount,
                    language: languages,
                    modulesURL: uni.modules_url || '#'
                },
                exchange: {
                    upcomingExchanges: periods.length,
                    periods: periods
                }
            }
        }).sort((a, b) => a.name.localeCompare(b.name))
    } catch (error) {
        console.error('Error fetching universities from Supabase:', error.message)
    } finally {
        uniIsLoading.value = false
    }
}

// Shortlist
const shortlist = ref([])
const shortlistIsLoading = ref(true)
async function fetchShortlist() {
    shortlistIsLoading.value = true
    if (!auth.user) return

    try {
        const { data, error } = await supabase
            .from('shortlists')
            .select('*')
            .eq('user_id', auth.user.id)
            .order('id', { ascending: false })

        if (error) throw error

        shortlist.value = data
    } catch (error) {
        console.error('Error fetching shortlist from Supabase:', error.message)
    } finally {
        shortlistIsLoading.value = false
    }
}

const shortlistedIds = computed(() => {
    return shortlist.value.map(item => item.university_id)
})

const shortlistedUnis = computed(() => {
    return universities.value.filter(uni => shortlistedIds.value.includes(uni.id))
})

const remainingUnis = computed(() => {
    return universities.value.filter(uni => !shortlistedIds.value.includes(uni.id))
})

const isShortlisted = (uniId) => {
    return shortlistedIds.value.includes(uniId)
}

async function toggleShortlist(uniId) {
    shortlistIsLoading.value = true
    if (!auth.user) {
        return router.push({
            name: 'login',
            query: { redirect: '/compare' }
        })
    }

    try {
        if (isShortlisted(uniId)) {
            const { error } = await supabase
                .from('shortlists')
                .delete()
                .eq('user_id', auth.user.id)
                .eq('university_id', uniId)

            if (error) throw error
            shortlist.value = shortlist.value.filter(item => item.university_id !== uniId)
        } else {
            const { data, error } = await supabase
                .from('shortlists')
                .insert({
                    user_id: auth.user.id,
                    university_id: uniId
                })
                .select()
                .single()

            if (error) throw error
            if (data) shortlist.value.push(data)
        }
    } catch (error) {
        console.error(error.message)
    } finally {
        shortlistIsLoading.value = false
    }
}

// Compare
const COMPARE_STORAGE_KEY = 'SMUXchange_compare_slots'
function getStoredCompareSlots() {
    try {
        const raw = sessionStorage.getItem(COMPARE_STORAGE_KEY)
        if (!raw) return [null, null, null]
        
        const slots = JSON.parse(raw)

        if (Array.isArray(slots) && slots.length === 3
            && slots.every(id => id === null || (Number.isSafeInteger(id) && id > 0)) 
            && new Set(slots.filter(id => id !== null)).size === slots.filter(id => id !== null).length) {
            return slots
        }
    } catch (error) {
        console.error(`Failed to restore compare selection: `, error)
    }
    return [null, null, null]
}

const uniSlots = ref(getStoredCompareSlots())
const uniCurrencies = ref(['home', 'home', 'home'])
const uniProgrammes = ref([0, 0, 0])

const unisToCompare = computed (() => {
    return uniSlots.value.map(id => {
        return universities.value.find(uni => uni.id === id) || null })
})

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
    if (oldUniId === uniId) return

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

const openDropdownIndex = ref(null)
function openDropdown(idx) {
    openDropdownIndex.value = openDropdownIndex.value === idx ? null : idx
}

function chooseUniversity(idx, universityId) {
    selectUniversity(idx, universityId)
    openDropdownIndex.value = null
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
    if (!uni || !element || !uni.location.coordinates.lat) return

    const { lat, lon } = uni.location.coordinates

    const map = L.map(element, { scrollWheelZoom: false }).setView([lat, lon], 13)

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

// Location Helper
function formatLocation(location) {
    if (!location) return ''
    const { city, state, country } = location
    if (city === state && state === country) return country
    if (city === state || state === country) return `${city}, ${country}`
    return `${city}, ${state}, ${country}`
}

function distanceFromSMU(coordinates) {
    if (!coordinates?.lat || !coordinates?.lon) return '-'
    const lat1 = 1.29627
    const lon1 = 103.85185
    const lat2 = coordinates.lat
    const lon2 = coordinates.lon
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c)
}

// FX Rates - Frankfurter API
const currencyRates = ref([])
async function fetchCurrencyRates() {
    const url = "https://api.frankfurter.dev/v2/rates?base=sgd"
    try {
        const response = await axios.get(url)
        const data = response.data.map(({base, ...rest}) => rest)
        currencyRates.value = data
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

// Cost/Currency Helpers
function formatCurrency(value, currency) {
    if (value === null || value === undefined) return '-'
    return value.toLocaleString('en-SG', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0
    })
}

function formatCost(value, homeCurrency, idx) {
    if (value === null || value === undefined) return '-'
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

// Lifecycle
onMounted(async () => {
    await Promise.all([
        fetchCurrencyRates(),
        fetchShortlist(),
        fetchUniversities()
    ])
    unisToCompare.value.forEach((uni, idx) => createMap(idx))
})

watch(
    () => [...uniSlots.value],
    (newSlots, oldSlots) => {
        sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(newSlots))
        newSlots.forEach((slot, idx) => {
            if (slot !== oldSlots[idx]) {
                uniCurrencies.value[idx] = 'home'
                uniProgrammes.value[idx] = 0
                createMap(idx)
            }
        })
    }
)
</script>

<template>
    <div class="container-fluid min-vh-100 d-flex flex-column p-0">
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
                    <template #default="{ idx }">
                        <div class="compare-uni-dropdown">
                            <button
                                type="button"
                                class="form-select fs-5 fw-semibold text-start compare-uni-select"
                                :aria-expanded="openDropdownIndex === idx"
                                :aria-controls="`compare-uni-menu-${idx}`"
                                @click="openDropdown(idx)"
                            >
                                <span class="d-block text-truncate">{{ unisToCompare[idx]?.name || 'Choose a university' }}</span>
                            </button>
                            <div
                                v-if="openDropdownIndex === idx"
                                :id="`compare-uni-menu-${idx}`"
                                class="compare-uni-menu text-start"
                                role="listbox"
                                aria-label="Choose a university to compare"
                            >
                                <button class="compare-uni-option" type="button" @click="chooseUniversity(idx, null)">
                                    Choose a university
                                </button>
                                <template v-if="shortlistedUnis.length">
                                    <div class="compare-uni-group-label">My Shortlist</div>
                                    <button
                                        v-for="university in shortlistedUnis"
                                        :key="university.id"
                                        class="compare-uni-option"
                                        :class="{ selected: uniSlots[idx] === university.id }"
                                        :disabled="uniSlots[idx] === null && uniSlots.some((id, i) => i !== idx && id === university.id)"
                                        role="option"
                                        :aria-selected="uniSlots[idx] === university.id"
                                        @click="chooseUniversity(idx, university.id)"
                                    >
                                        {{ university.name }}
                                    </button>
                                </template>
                                <template v-if="remainingUnis.length">
                                    <div class="compare-uni-group-label">Other Universities</div>
                                    <button
                                        v-for="university in remainingUnis"
                                        :key="university.id"
                                        class="compare-uni-option"
                                        :class="{ selected: uniSlots[idx] === university.id }"
                                        :disabled="uniSlots[idx] === null && uniSlots.some((id, i) => i !== idx && id === university.id)"
                                        role="option"
                                        :aria-selected="uniSlots[idx] === university.id"
                                        @click="chooseUniversity(idx, university.id)"
                                    >
                                        {{ university.name }}
                                    </button>
                                </template>
                            </div>
                        </div>
                    </template>
                </CompareRow>

                <!-- Uni Info -->
                <CompareRow :unis-to-compare="unisToCompare" special-vfor-class="text-center d-flex flex-column"
                special-vif-class="d-flex flex-column flex-grow-1">
                    <template #default="{ uni }">
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
                    <template #default="{ uni }">
                        <div class="text-secondary my-3 d-flex align-items-center justify-content-center h-100 text-break">
                            {{ uni.location.country }}
                        </div>
                    </template>
                </CompareRow>


                <CompareRow :unis-to-compare="unisToCompare" special-vfor-class="text-center d-flex flex-column"
                special-vif-class="d-flex flex-column flex-grow-1">
                    <template #default="{ uni }">
                        <div class="border-top pt-3">
                            <button class="btn rounded-pill px-3" :class="isShortlisted(uni.id) ? 'btn-success' : 'btn-primary'" 
                            :disabled="shortlistIsLoading" @click="toggleShortlist(uni.id)">
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
                    <template #default="{ }">
                        Location
                    </template>
                </CompareRowHeader>

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ idx }">
                        <div :ref="el => mapElements[idx] = el" class="uni-map mt-3">
                        </div>
                    </template>
                </CompareRow>   

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ }">
                        <div class="text-secondary small pt-3">
                            Location
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div class="text-break">
                            {{ formatLocation(uni.location) }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Region
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div class="text-break">
                            {{ uni.location.region }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Timezone
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div class="text-break">
                            {{ uni.location.timezone }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Distance from SG
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div class="text-break">
                            {{ distanceFromSMU(uni.location.coordinates) }} km
                        </div>
                    </template>
                </CompareRow>  

                <!-- Cost -->
                <CompareRowHeader :unis-to-compare="unisToCompare">
                    <template #default="{ }">
                        Cost
                    </template>
                </CompareRowHeader>

                <CompareRow :unis-to-compare="unisToCompare"  special-vif-class="h-100">
                    <template #default="{ uni, idx }">
                        <div class="d-flex flex-column flex-md-row justify-content-between align-items-center h-100 gap-3 pt-3">
                            <div class="text-break text-center text-md-start text-secondary fw-semibold">
                                1 SGD = {{ ratesMap[uni.cost.currency] || '-'}} {{ uni.cost.currency }}
                            </div>
                            <div class="btn-group btn-group-sm w-md-down-100">
                                <button class="btn" :class="uniCurrencies[idx] === 'home' ? 'btn-primary' : 'btn-outline-primary'"
                                @click="uniCurrencies[idx] = 'home'">{{ uni.cost.currency }}</button>
                                <button class="btn" :class="uniCurrencies[idx] === 'SGD' ? 'btn-primary' : 'btn-outline-primary'"
                                @click="uniCurrencies[idx] = 'SGD'">SGD</button>
                            </div>
                        </div> 
                    </template>
                </CompareRow>                

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ }">
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
                    <template #default="{ }">
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
                    <template #default="{ }">
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
                    <template #default="{ }">
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
                    <template #default="{ }">
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
                    <template #default="{ }">
                        Academics
                    </template>
                </CompareRowHeader>

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ }">
                        <div class="text-secondary small pt-3">
                            Mapped Modules
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div class="text-break fw-bold fs-4">
                            {{  uni.academic.mappedModules }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ }">
                        <div class="text-secondary small mt-3 pt-3 border-top">
                            Language
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div class="text-break">
                            {{ uni.academic.language }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div class="mt-3 pt-3 border-top">
                            <a :href="uni.academic.modulesURL" class="link-primary text-decoration-none custom-hover-link" 
                                target="_blank" rel="noopener noreferrer">View Course Catalogue<i class="bi bi-chevron-right ms-1" style="font-size: 12px;"></i></a>
                        </div>
                    </template>
                </CompareRow>
                
                <!-- Exchange -->
                <CompareRowHeader :unis-to-compare="unisToCompare">
                    <template #default="{ }">
                        Exchange
                    </template>
                </CompareRowHeader>

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div v-if="uni && uni.exchange?.periods?.length > 0">
                            <div class="d-flex w-100 pt-3 gap-1">
                                <button v-for="(period, pIdx) in uni.exchange.periods" :key="pIdx"
                                    @click="uniProgrammes[idx] = pIdx"
                                    class="btn btn-sm flex-fill text-truncate px-1"
                                    :class="uniProgrammes[idx] === pIdx ? 'btn-primary' : 'btn-outline-primary'">
                                    {{ formatExchangeDate(period.startDate) }}
                                </button>
                            </div>
                        </div>
                        <div v-else>
                            <div class="pt-3">
                                <button class="btn btn-sm btn-outline-secondary w-100 disabled text-truncate" style="opacity: 1;">
                                    Not Available
                                </button>
                            </div>
                        </div>
                    </template>
                </CompareRow>

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div v-if="uni && uni.exchange?.periods?.length > 0"
                            class="text-secondary small pt-3">
                            Programme
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div v-if="uni && uni.exchange?.periods?.length > 0" 
                            class="text-break fw-bold fs-4">
                            {{ uni.exchange.periods[uniProgrammes[idx]].periodName }}
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div v-if="uni && uni.exchange?.periods?.length > 0" 
                            class="text-secondary small mt-3 pt-3 border-top">
                            Exchange Period
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div v-if="uni && uni.exchange?.periods?.length > 0" 
                            class="text-break">
                            {{ formatExchangeDate(uni.exchange.periods[uniProgrammes[idx]].startDate) }} - 
                            {{ formatExchangeDate(uni.exchange.periods[uniProgrammes[idx]].endDate) }}
                        </div>
                    </template>
                </CompareRow>
                
                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div v-if="uni && uni.exchange?.periods?.length > 0"  
                            class="text-secondary small mt-3 pt-3 border-top">
                            Temperature
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div v-if="uni && uni.exchange?.periods?.length > 0"  
                            class="text-break">
                            {{ uni.exchange.periods[uniProgrammes[idx]].minTemp }} - 
                            {{ uni.exchange.periods[uniProgrammes[idx]].maxTemp }} °C
                        </div>
                    </template>
                </CompareRow>

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni }">
                        <div v-if="uni && uni.exchange?.periods?.length > 0"  
                            class="text-secondary small mt-3 pt-3 border-top">
                            Overview
                        </div>
                    </template>
                </CompareRow>  

                <CompareRow :unis-to-compare="unisToCompare">
                    <template #default="{ uni, idx }">
                        <div v-if="uni && uni.exchange?.periods?.length > 0"  
                            class="text-break">
                            {{ uni.exchange.periods[uniProgrammes[idx]].description }}
                        </div>
                    </template>
                </CompareRow>

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
    top: var(--app-navbar-height);
    z-index: 1030;
    background-color: white;
    padding-top: 12px;
    padding-bottom: 12px;
}
.compare-uni-dropdown {
    position: relative;
    width: 100%;
}
.sticky-uni-selector .compare-uni-select {
    width: 100%;
    min-width: 0;
    font-size: clamp(0.8rem, 1.5vw, 1.25rem) !important;
    padding: 0.75rem 2rem 0.75rem 0.75rem !important;
}
.compare-uni-menu {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    z-index: 1035;
    width: 100%;
    max-height: min(50vh, 22rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    border: 1px solid #d7deea;
    border-radius: 0.5rem;
    background: #fff;
    box-shadow: 0 0.5rem 1rem rgba(11, 35, 72, 0.18);
    scrollbar-width: thin;
    scrollbar-color: #9aa9bf #f1f5fc;
}
.compare-uni-group-label {
    padding: 0.5rem 0.75rem 0.25rem;
    color: #52627a;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
}
.compare-uni-option {
    display: block;
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 0;
    background: #fff;
    color: #0b2348;
    text-align: left;
    overflow-wrap: anywhere;
}
.compare-uni-option:hover:not(:disabled),
.compare-uni-option.selected {
    background: #f1f5fc;
}
.compare-uni-option:focus-visible {
    position: relative;
    z-index: 1;
    outline: 2px solid #1f4e9c;
    outline-offset: -2px;
}
.compare-uni-option:disabled {
    color: #8793a6;
    cursor: not-allowed;
}
.custom-select-blue {
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
    .sticky-uni-selector .compare-uni-select {
        font-size: clamp(0.75rem, 3.2vw, 1rem) !important;
        padding: 0.625rem 1.75rem 0.625rem 0.625rem !important;
    }

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

    .w-md-down-100 {
        display: flex !important;
        width: 100% !important;
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
