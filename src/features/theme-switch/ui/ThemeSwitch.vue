<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import appreciationAnimationUrl from '@/shared/assets/lottie/system-outline-27-globe-loop-cycle.json?url'
import { useUiStore } from '@/stores/ui'

const props = withDefaults(
  defineProps<{
    showLabel?: boolean
    disabled?: boolean
    appreciationEnabled?: boolean
  }>(),
  {
    showLabel: true,
    disabled: false,
    appreciationEnabled: false,
  },
)

const emit = defineEmits<{
  change: [boolean]
}>()

const uiStore = useUiStore()
const LONG_PRESS_MS = 600
const pressing = ref(false)
let longPressTimer: number | null = null
let enterModeTimer: number | null = null
let suppressNextClick = false
const enteringAppreciation = ref(false)

const isDark = computed(() => uiStore.darkMode)
const isAppreciating = computed(() => uiStore.appreciationMode)
const showAppreciationIcon = computed(() => enteringAppreciation.value || isAppreciating.value)
const switchLabel = computed(() => (isAppreciating.value ? 'ZEN' : isDark.value ? '深色模式' : '浅色模式'))
const switchDescription = computed(() => props.appreciationEnabled ? '点击切换主题 · 长按欣赏背景' : '切换全局主题')
const ariaLabel = computed(() => {
  if (isAppreciating.value) return `退出 ZEN，长按${isDark.value ? '切换到浅色模式' : '切换到深色模式'}`
  const themeLabel = isDark.value ? '切换到浅色模式' : '切换到深色模式'
  return props.appreciationEnabled ? `${themeLabel}，长按进入 ZEN` : themeLabel
})

function clearLongPress() {
  if (longPressTimer !== null) {
    window.clearTimeout(longPressTimer)
    longPressTimer = null
  }
  pressing.value = false
}

function clearEnterModeTimer() {
  if (enterModeTimer !== null) {
    window.clearTimeout(enterModeTimer)
    enterModeTimer = null
  }
}

function startLongPress(event: PointerEvent) {
  if (props.disabled || (!props.appreciationEnabled && !isAppreciating.value)) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  clearLongPress()
  pressing.value = true
  longPressTimer = window.setTimeout(() => {
    longPressTimer = null
    pressing.value = false
    suppressNextClick = true

    if (isAppreciating.value) {
      uiStore.toggleDarkMode()
      return
    }

    enteringAppreciation.value = true
    enterModeTimer = window.setTimeout(() => {
      enterModeTimer = null
      uiStore.enterAppreciationMode()
      enteringAppreciation.value = false
    }, 280)
  }, LONG_PRESS_MS)
}

function onToggle() {
  if (props.disabled) return
  clearLongPress()

  if (suppressNextClick) {
    suppressNextClick = false
    return
  }

  if (isAppreciating.value) {
    uiStore.exitAppreciationMode()
    return
  }

  const next = !uiStore.darkMode
  uiStore.setDarkMode(next)
  emit('change', next)
}

onBeforeUnmount(() => {
  clearLongPress()
  clearEnterModeTimer()
})
</script>

<template>
  <button
    type="button"
    :aria-label="ariaLabel"
    :aria-pressed="isAppreciating || isDark"
    :disabled="disabled"
    class="theme-switch-root"
    :class="disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
    :data-pressing="pressing ? 'true' : 'false'"
    @pointerdown="startLongPress"
    @pointerup="clearLongPress"
    @pointercancel="clearLongPress"
    @pointerleave="clearLongPress"
    @contextmenu.prevent
    @click="onToggle"
  >
    <span class="theme-switch-button">
      <Transition name="theme-switch-icon">
        <lord-icon
          v-if="showAppreciationIcon"
          key="appreciation"
          class="theme-switch-icon theme-switch-icon--appreciation current-color"
          :src="appreciationAnimationUrl"
          trigger="loop"
        />
        <svg
          v-else-if="!isDark"
          key="sun"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="theme-switch-icon theme-switch-icon--sun"
        >
          <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.9" />
          <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.9">
            <path d="M12 2.7v2.2" /><path d="M12 19.1v2.2" /><path d="M4.91 4.91l1.56 1.56" />
            <path d="M17.53 17.53l1.56 1.56" /><path d="M2.7 12h2.2" /><path d="M19.1 12h2.2" />
            <path d="M4.91 19.09l1.56-1.56" /><path d="M17.53 6.47l1.56-1.56" />
          </g>
        </svg>
        <svg
          v-else
          key="moon"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="theme-switch-icon"
        >
          <path d="M7 6c0 6.08 4.92 11 11 11c0.53 0 1.05 -0.04 1.56 -0.11c-1.61 2.47 -4.39 4.11 -7.56 4.11c-4.97 0 -9 -4.03 -9 -9c0 -3.17 1.64 -5.95 4.11 -7.56c-0.07 0.51 -0.11 1.03 -0.11 1.56Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          <g fill="currentColor">
            <path d="M15.22 6.03l2.53 -1.94l-3.19 -0.09l-1.06 -3l-1.06 3l-3.19 0.09l2.53 1.94l-0.91 3.06l2.63 -1.81l2.63 1.81l-0.91 -3.06Z"><animate attributeName="opacity" dur="6s" keyTimes="0;0.1;0.4;0.5;1" repeatCount="indefinite" values="0;1;1;0;0" /></path>
            <path d="M19.61 12.25l1.64 -1.25l-2.06 -0.05l-0.69 -1.95l-0.69 1.95l-2.06 0.05l1.64 1.25l-0.59 1.98l1.7 -1.17l1.7 1.17l-0.59 -1.98Z"><animate attributeName="opacity" dur="6s" keyTimes="0;0.2;0.3;0.6;0.7;1" repeatCount="indefinite" values="0;0;1;1;0;0" /></path>
          </g>
        </svg>
      </Transition>
    </span>

    <span v-if="showLabel" class="min-w-0">
      <span class="block text-sm font-medium text-[var(--color-text)]">{{ switchLabel }}</span>
      <span class="mt-0.5 block text-xs text-[var(--color-text-muted)]">{{ switchDescription }}</span>
    </span>
  </button>
</template>

<style scoped>
.theme-switch-root { display:inline-flex; align-items:center; gap:.75rem; flex-shrink:0; padding:0; border:0; background:transparent; }
.theme-switch-button { position:relative; display:inline-flex; height:2.85rem; width:2.85rem; align-items:center; justify-content:center; border-radius:999px; color:var(--color-text-muted); transition:color 220ms ease, background-color 220ms ease, transform 220ms cubic-bezier(.22,1,.36,1); }
.theme-switch-root[data-pressing='true'] .theme-switch-button { transform:scale(.9); color:var(--color-primary); }
.theme-switch-icon { position:absolute; inset:50% auto auto 50%; height:1.3rem; width:1.3rem; transform:translate(-50%, -50%); }
.theme-switch-icon--appreciation { height:1.55rem; width:1.55rem; }
.theme-switch-icon--appreciation.current-color { --lord-icon-primary:currentColor; --lord-icon-secondary:currentColor; }
.theme-switch-icon--sun { transition:transform 560ms cubic-bezier(.22,.8,.3,1); transform-origin:50% 50%; }
.theme-switch-root:hover .theme-switch-icon--sun { transform:translate(-50%, -50%) rotate(120deg); }
.theme-switch-icon-enter-active,.theme-switch-icon-leave-active { transition:opacity 420ms cubic-bezier(.22,1,.36,1), transform 420ms cubic-bezier(.22,1,.36,1); }
.theme-switch-icon-enter-from,.theme-switch-icon-leave-to { opacity:0; transform:translate(-50%, -50%) scale(.82) rotate(-14deg); }
.theme-switch-icon-enter-to,.theme-switch-icon-leave-from { opacity:1; transform:translate(-50%, -50%) scale(1) rotate(0); }
@media (prefers-reduced-motion: reduce) { .theme-switch-button,.theme-switch-icon-enter-active,.theme-switch-icon-leave-active { transition-duration:.01ms; } }
</style>
