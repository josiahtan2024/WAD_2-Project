import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js' // Bootstrap 5 (https://getbootstrap.com), MIT
import './assets/styles/theme.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)

  const auth = useAuthStore(pinia)

  try {
    await auth.init()
  } catch (error) {
    console.error('Unable to initialize authentication:', error.message)
  }

  app.use(router)
  app.mount('#app')
}

bootstrap()