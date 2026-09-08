import { createApp } from 'vue'
import { MotionPlugin } from '@vueuse/motion'

import App from './App.vue'
import { pinia } from '@/app/providers/pinia'
import { setupQueryClient } from '@/app/providers/query'
import { createAppRouter } from '@/app/router'
import { setupApiSideEffects } from '@/app/providers/setupApiSideEffects'
import { useUiStore } from '@/stores'
import '@/app/styles/index.css'

let animatedIconRegistrationStarted = false
const ANIMATED_ICON_REGISTER_DELAY_MS = 900
const ANIMATED_ICON_IDLE_TIMEOUT_MS = 900

function registerAnimatedIconElement() {
  if (typeof window === 'undefined' || window.customElements.get('lord-icon')) return

  const register = async () => {
    if (animatedIconRegistrationStarted || window.customElements.get('lord-icon')) return
    animatedIconRegistrationStarted = true

    const [{ defineElement }, lottie] = await Promise.all([
      import('@lordicon/element'),
      import('lottie-web/build/player/lottie_svg'),
    ])

    if (!window.customElements.get('lord-icon')) {
      defineElement(lottie.default.loadAnimation)
    }
  }

  window.setTimeout(() => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        void register()
      }, { timeout: ANIMATED_ICON_IDLE_TIMEOUT_MS })
      return
    }

    window.setTimeout(() => {
      void register()
    }, 1)
  }, ANIMATED_ICON_REGISTER_DELAY_MS)
}

const app = createApp(App)
const router = createAppRouter()

app.use(pinia)
app.use(MotionPlugin)
setupQueryClient(app)
setupApiSideEffects(router)
app.use(router)

useUiStore(pinia).initializeUiPreferences()

app.mount('#app')
registerAnimatedIconElement()
