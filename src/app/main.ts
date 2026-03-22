import { createApp } from 'vue'

import App from './App.vue'
import { pinia } from '@/app/providers/pinia'
import { createAppRouter } from '@/app/router'
import { setupApiSideEffects } from '@/app/providers/setupApiSideEffects'
import { useUiStore } from '@/stores'
import '@/app/styles/index.css'

const app = createApp(App)
const router = createAppRouter()

app.use(pinia)
app.use(router)

useUiStore(pinia).initializeUiPreferences()

setupApiSideEffects(router)

app.mount('#app')
