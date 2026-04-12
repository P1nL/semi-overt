<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  siteKey: string
}>()

const emit = defineEmits<{
  (e: 'verified', token: string): void
  (e: 'expired'): void
  (e: 'error'): void
}>()

const containerEl = ref<HTMLDivElement | null>(null)
let widgetId: string | undefined

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

function renderWidget() {
  if (!containerEl.value || !window.turnstile) return

  widgetId = window.turnstile.render(containerEl.value, {
    sitekey: props.siteKey,
    theme: 'light',
    language: 'zh-CN',
    callback: (token: string) => emit('verified', token),
    'expired-callback': () => emit('expired'),
    'error-callback': () => emit('error'),
  })
}

function loadScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.turnstile) {
      resolve()
      return
    }
    // 已有脚本标签在加载中，直接挂回调
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="turnstile"]',
    )
    if (existing) {
      window.onTurnstileLoad = resolve
      return
    }
    window.onTurnstileLoad = resolve
    const script = document.createElement('script')
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  })
}

onMounted(async () => {
  await loadScript()
  renderWidget()
})

onUnmounted(() => {
  if (widgetId !== undefined && window.turnstile) {
    window.turnstile.remove(widgetId)
  }
})

/** 重置 widget，token 失效时由父组件调用 */
function reset() {
  if (widgetId !== undefined && window.turnstile) {
    window.turnstile.reset(widgetId)
  }
}

defineExpose({ reset })
</script>

<template>
  <div ref="containerEl" class="turnstile-container" />
</template>

<style scoped>
.turnstile-container {
  /* Turnstile widget 自带尺寸，保持 inline-block 避免撑满 */
  display: inline-block;
}
</style>
