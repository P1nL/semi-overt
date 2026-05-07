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

  const schedule = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 1))
  window.setTimeout(() => schedule(() => {
    void register()
  }), 1800)
}

const app = createApp(App)
const router = createAppRouter()

app.use(pinia)
app.use(MotionPlugin)
setupQueryClient(app)
app.use(router)

useUiStore(pinia).initializeUiPreferences()

setupApiSideEffects(router)

app.mount('#app')
registerAnimatedIconElement()
