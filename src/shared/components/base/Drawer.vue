<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { cn } from '@/shared/utils/cn'
import IconButton from './IconButton.vue'
import Icon from './Icon.vue'

type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom'
type DrawerSize = 'sm' | 'md' | 'lg' | 'full'

const props = withDefaults(
    defineProps<{
      modelValue: boolean
      title?: string
      description?: string
      placement?: DrawerPlacement
      size?: DrawerSize
      closeOnBackdrop?: boolean
      closeOnEsc?: boolean
      persistent?: boolean
    }>(),
    {
      title: '',
      description: '',
      placement: 'right',
      size: 'md',
      closeOnBackdrop: true,
      closeOnEsc: true,
      persistent: false,
    },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'open'): void
  (e: 'close'): void
  (e: 'after-leave'): void
}>()

const panelRef = ref<HTMLElement | null>(null)
const visible = ref(props.modelValue)
const activeBeforeOpen = ref<HTMLElement | null>(null)

const panelClass = computed(() => {
  const base = 'surface-1 fixed z-50 overflow-hidden shadow-[var(--shadow-lg)] outline-none'
  const sizeMap = {
    sm: { side: 'w-80', topBottom: 'h-64' },
    md: { side: 'w-[28rem]', topBottom: 'h-80' },
    lg: { side: 'w-[36rem]', topBottom: 'h-[32rem]' },
    full: { side: 'w-screen', topBottom: 'h-screen' },
  } as const

  switch (props.placement) {
    case 'left':
      return cn(base, 'inset-y-0 left-0 rounded-r-[var(--radius-xl)]', sizeMap[props.size].side)
    case 'right':
      return cn(base, 'inset-y-0 right-0 rounded-l-[var(--radius-xl)]', sizeMap[props.size].side)
    case 'top':
      return cn(base, 'inset-x-0 top-0 rounded-b-[var(--radius-xl)]', sizeMap[props.size].topBottom)
    case 'bottom':
      return cn(base, 'inset-x-0 bottom-0 rounded-t-[var(--radius-xl)]', sizeMap[props.size].topBottom)
  }
})

const transitionClass = computed(() => {
  switch (props.placement) {
    case 'left':
      return {
        enterFrom: '-translate-x-full',
        leaveTo: '-translate-x-full',
      }
    case 'right':
      return {
        enterFrom: 'translate-x-full',
        leaveTo: 'translate-x-full',
      }
    case 'top':
      return {
        enterFrom: '-translate-y-full',
        leaveTo: '-translate-y-full',
      }
    case 'bottom':
      return {
        enterFrom: 'translate-y-full',
        leaveTo: 'translate-y-full',
      }
  }
})

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [] as HTMLElement[]

  return Array.from(
      container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
  )
}

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onBackdropClick() {
  if (props.persistent || !props.closeOnBackdrop) return
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (!visible.value) return

  if (event.key === 'Escape' && props.closeOnEsc && !props.persistent) {
    event.preventDefault()
    close()
    return
  }

  if (event.key !== 'Tab') return

  const elements = getFocusableElements(panelRef.value)
  if (!elements.length) return

  const first = elements[0]
  const last = elements[elements.length - 1]
  const active = document.activeElement as HTMLElement | null

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
    () => props.modelValue,
    async (value) => {
      visible.value = value

      if (value) {
        activeBeforeOpen.value = document.activeElement as HTMLElement | null
        document.body.style.overflow = 'hidden'
        emit('open')

        await nextTick()
        getFocusableElements(panelRef.value)[0]?.focus()
      } else {
        document.body.style.overflow = ''
        emit('after-leave')
        activeBeforeOpen.value?.focus?.()
      }
    },
    { immediate: true },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50" @keydown="onKeydown">
      <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
      >
        <div
            class="absolute inset-0 bg-[color-mix(in_srgb,var(--color-overlay)_88%,transparent)] backdrop-blur-sm"
            @click="onBackdropClick"
        />
      </Transition>

      <Transition
          enter-active-class="transition duration-300 ease-out"
          :enter-from-class="cn('transform', transitionClass.enterFrom)"
          enter-to-class="transform translate-x-0 translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="transform translate-x-0 translate-y-0"
          :leave-to-class="cn('transform', transitionClass.leaveTo)"
      >
        <section
            ref="panelRef"
            :class="panelClass"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
          <header
              class="flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass)_76%,transparent)] px-5 py-4 md:px-6"
          >
            <div class="min-w-0">
              <h2 v-if="title" class="text-lg font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                {{ title }}
              </h2>
              <p v-if="description" class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                {{ description }}
              </p>
            </div>

            <IconButton
              ariaLabel="Close drawer"
              variant="ghost"
              size="sm"
              class="!border-transparent !bg-transparent !shadow-none hover:!border-transparent hover:!bg-transparent"
              @click="close"
            >
              <Icon name="close" :size="16" />
            </IconButton>
          </header>

          <div class="h-[calc(100%-73px)] overflow-y-auto px-5 py-5 md:px-6">
            <slot />
          </div>

          <footer
              v-if="$slots.footer"
              class="border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass)_74%,transparent)] px-5 py-4 md:px-6"
          >
            <slot name="footer" />
          </footer>
        </section>
      </Transition>
    </div>
  </Teleport>
</template>
