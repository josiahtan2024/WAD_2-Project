import { defineStore } from 'pinia'
import axios from 'axios'

export const useExchangeRatesStore = defineStore('exchangeRates', {
  state: () => ({
    rates: { SGD: 1 },
    loading: false,
    loaded: false,
    error: null,
  }),

  actions: {
    async load() {
      if (this.loading || this.loaded) return

      this.loading = true
      this.error = null

      try {
        const { data } = await axios.get(
          'https://api.frankfurter.dev/v2/rates?base=sgd'
        )

        this.rates = {
          ...Object.fromEntries(
            data.map(item => [item.quote, item.rate])
          ),
          SGD: 1,
        }

        this.loaded = true
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },
  },
})