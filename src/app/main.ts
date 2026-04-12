import { createApp } from 'vue'
import { defineElement } from '@lordicon/element'
import lottie from 'lottie-web/build/player/lottie_svg'
import { MotionPlugin } from '@vueuse/motion'

import App from './App.vue'
import { pinia } from '@/app/providers/pinia'
import { setupQueryClient } from '@/app/providers/query'
import { createAppRouter } from '@/app/router'
import { setupApiSideEffects } from '@/app/providers/setupApiSideEffects'
import { useUiStore } from '@/stores'
import '@/app/styles/index.css'

defineElement(lottie.loadAnimation)

const app = createApp(App)
const router = createAppRouter()

app.use(pinia)
app.use(MotionPlugin)
setupQueryClient(app)
app.use(router)

useUiStore(pinia).initializeUiPreferences()

setupApiSideEffects(router)

app.mount('#app')
