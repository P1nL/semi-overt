<script setup lang="ts">
import { computed } from 'vue'

import { useUiStore } from '@/stores/ui'

const props = withDefaults(
  defineProps<{
    showLabel?: boolean
    disabled?: boolean
  }>(),
  {
    showLabel: true,
    disabled: false,
  },
)

const emit = defineEmits<{
  change: [boolean]
}>()

const uiStore = useUiStore()

const isDark = computed(() => uiStore.darkMode)
const switchLabel = computed(() => (isDark.value ? '深色模式' : '浅色模式'))
const switchDescription = computed(() => '切换全局主题')
const ariaLabel = computed(() => (isDark.value ? '切换到浅色模式' : '切换到深色模式'))

function onToggle() {
  if (props.disabled) return
  const next = !uiStore.darkMode
  uiStore.setDarkMode(next)
  emit('change', next)
}
</script>

<template>
  <button
    type="button"
    :aria-label="ariaLabel"
    :aria-pressed="isDark"
    :disabled="disabled"
    class="theme-switch-root"
    :class="disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
    @click="onToggle"
  >
    <span class="theme-switch-button">
      <Transition name="theme-switch-icon" mode="out-in">
        <svg
          v-if="!isDark"
          key="sun"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="theme-switch-icon"
        >
          <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.9" />
          <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.9">
            <path d="M12 2.7v2.2" />
            <path d="M12 19.1v2.2" />
            <path d="M4.91 4.91l1.56 1.56" />
            <path d="M17.53 17.53l1.56 1.56" />
            <path d="M2.7 12h2.2" />
            <path d="M19.1 12h2.2" />
            <path d="M4.91 19.09l1.56-1.56" />
            <path d="M17.53 6.47l1.56-1.56" />
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
          <path
            d="M7 6c0 6.08 4.92 11 11 11c0.53 0 1.05 -0.04 1.56 -0.11c-1.61 2.47 -4.39 4.11 -7.56 4.11c-4.97 0 -9 -4.03 -9 -9c0 -3.17 1.64 -5.95 4.11 -7.56c-0.07 0.51 -0.11 1.03 -0.11 1.56Z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
          <g fill="currentColor">
            <path d="M15.22 6.03l2.53 -1.94l-3.19 -0.09l-1.06 -3l-1.06 3l-3.19 0.09l2.53 1.94l-0.91 3.06l2.63 -1.81l2.63 1.81l-0.91 -3.06Z">
              <animate
                attributeName="opacity"
                dur="6s"
                keyTimes="0;0.1;0.4;0.5;1"
                repeatCount="indefinite"
                values="0;1;1;0;0"
              />
            </path>
            <path d="M19.61 12.25l1.64 -1.25l-2.06 -0.05l-0.69 -1.95l-0.69 1.95l-2.06 0.05l1.64 1.25l-0.59 1.98l1.7 -1.17l1.7 1.17l-0.59 -1.98Z">
              <animate
                attributeName="opacity"
                dur="6s"
                keyTimes="0;0.2;0.3;0.6;0.7;1"
                repeatCount="indefinite"
                values="0;0;1;1;0;0"
              />
            </path>
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
.theme-switch-root {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.theme-switch-button {
  display: inline-flex;
  height: 2.85rem;
  width: 2.85rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--color-text-muted);
  transition:
    color 220ms ease,
    background-color 220ms ease;
}

.theme-switch-icon {
  height: 1.125rem;
  width: 1.125rem;
}

.theme-switch-icon-enter-active,
.theme-switch-icon-leave-active {
  transition:
    opacity 420ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.theme-switch-icon-enter-from,
.theme-switch-icon-leave-to {
  opacity: 0;
  transform: scale(0.82) rotate(-14deg);
}

.theme-switch-icon-enter-to,
.theme-switch-icon-leave-from {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}
</style>
