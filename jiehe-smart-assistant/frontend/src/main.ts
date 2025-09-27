import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Vant UI components
import 'vant/lib/index.css'

// Tailwind CSS
import './assets/styles/tailwind.css'

// PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration)
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError)
      })
  })
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')

console.log('🚀 家和智能助手前端应用已启动')