<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

import Icon from '@/shared/components/base/Icon.vue'
import IconButton from '@/shared/components/base/IconButton.vue'

const props = withDefaults(
  defineProps<{
    open?: boolean
    inset?: 'default' | 'article'
    variant?: 'default' | 'full'
    scrollMode?: 'sheet' | 'content'
  }>(),
  {
    open: false,
    inset: 'default',
    variant: 'default',
    scrollMode: 'sheet',
  },
)

const emit = defineEmits<{
  close: []
}>()

let previousBodyOverflow = ''
let previousHtmlOverflow = ''

function restoreBodyLock() {
  if (typeof document === 'undefined') return

  document.documentElement.style.overflow = previousHtmlOverflow
  document.body.style.overflow = previousBodyOverflow
}

function syncBodyLock(locked: boolean) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  if (!locked) {
    restoreBodyLock()
    return
  }

  previousHtmlOverflow = document.documentElement.style.overflow
  previousBodyOverflow = document.body.style.overflow

  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

function onWindowKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key !== 'Escape') return

  event.preventDefault()
  emit('close')
}

watch(
  () => props.open,
  (value) => {
    syncBodyLock(value)

    if (typeof window === 'undefined') return

    if (value) {
      window.addEventListener('keydown', onWindowKeydown)
      return
    }

    window.removeEventListener('keydown', onWindowKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onWindowKeydown)
  }

  restoreBodyLock()
})
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-0 z-[70]">
      <Transition name="page-sheet-backdrop" appear>
        <button
          v-if="open"
          type="button"
          class="pointer-events-auto absolute inset-0 border-0 bg-[rgba(8,12,20,0.26)] backdrop-blur-[8px]"
          aria-label="Close panel"
          @click="emit('close')"
        />
      </Transition>

      <Transition name="page-sheet-close" appear>
        <div
          v-if="open"
          class="pointer-events-none absolute inset-x-0 top-0 flex h-20 items-center justify-end px-4 md:h-24 md:px-6"
        >
          <div class="pointer-events-auto">
            <IconButton
              ariaLabel="Close"
              variant="secondary"
              size="lg"
              pill
              class="bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_92%,transparent)] shadow-[0_12px_30px_rgb(15_23_42_/_0.12)] backdrop-blur-xl"
              @click="emit('close')"
            >
              <Icon name="close" :size="18" />
            </IconButton>
          </div>
        </div>
      </Transition>

      <Transition name="page-sheet-panel" appear>
        <section
          v-if="open"
          class="pointer-events-auto absolute inset-x-0 bottom-0 flex min-h-0 flex-col overflow-x-hidden bg-[color-mix(in_srgb,var(--color-surface)_92%,var(--color-surface-glass-strong)_8%)] backdrop-blur-[16px]"
          :class="
            props.variant === 'full'
              ? [
                  'top-0 rounded-none border-0 shadow-none',
                  props.scrollMode === 'content' ? 'overflow-y-hidden' : 'overflow-y-auto',
                ]
              : [
                  props.inset === 'article' ? 'top-20 md:top-24' : 'top-[4.75rem] md:top-[5.5rem]',
                  props.scrollMode === 'content' ? 'overflow-y-hidden' : 'overflow-y-auto',
                  'rounded-t-[2rem] border-x border-t border-[color-mix(in_srgb,var(--color-border)_82%,white_14%)] shadow-[0_-18px_48px_rgb(15_23_42_/_0.12)]',
                ]
          "
        >
          <div
            class="relative min-h-0 flex-1 overscroll-contain"
            :class="props.scrollMode === 'content' ? 'overflow-hidden' : ''"
          >
            <slot />
          </div>
        </section>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.page-sheet-backdrop-enter-active,
.page-sheet-backdrop-leave-active {
  transition: opacity 220ms ease;
}

.page-sheet-backdrop-enter-from,
.page-sheet-backdrop-leave-to {
  opacity: 0;
}

.page-sheet-close-enter-active,
.page-sheet-close-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.page-sheet-close-enter-from,
.page-sheet-close-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.page-sheet-panel-enter-active {
  transition:
    opacity 320ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.page-sheet-panel-leave-active {
  transition:
    opacity 240ms ease,
    transform 240ms cubic-bezier(0.4, 0, 1, 1);
}

.page-sheet-panel-enter-from,
.page-sheet-panel-leave-to {
  opacity: 0;
  transform: translateY(56px);
}
</style>
