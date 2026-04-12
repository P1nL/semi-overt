<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { cn } from '@/shared/utils/cn'
import IconButton from './IconButton.vue'
import Icon from './Icon.vue'

type DialogWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const props = withDefaults(
    defineProps<{
      modelValue: boolean
      title?: string
      description?: string
      closeOnBackdrop?: boolean
      closeOnEsc?: boolean
      width?: DialogWidth
      persistent?: boolean
    }>(),
    {
      title: '',
      description: '',
      closeOnBackdrop: true,
      closeOnEsc: true,
      width: 'md',
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

const widthClassMap: Record<DialogWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[min(100vw-2rem,72rem)]',
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [] as HTMLElement[]

  return Array.from(
      container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
  ).filter((node) => !node.hasAttribute('disabled') && !node.getAttribute('aria-hidden'))
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
        const elements = getFocusableElements(panelRef.value)
        elements[0]?.focus()
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

const showHeader = computed(() => props.title || props.description)
</script>

<template>
  <Teleport to="body">
    <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
    >
      <div
          v-if="visible"
          class="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-overlay)_88%,transparent)] p-4 backdrop-blur-sm"
          @keydown="onKeydown"
      >
        <div class="absolute inset-0" @click="onBackdropClick" />

        <div
            ref="panelRef"
            :class="
            cn(
              'surface-1 relative z-10 flex max-h-[min(100vh-2rem,48rem)] w-full flex-col overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] outline-none',
              widthClassMap[width],
            )
          "
            role="dialog"
            aria-modal="true"
            :aria-labelledby="title ? 'dialog-title' : undefined"
            :aria-describedby="description ? 'dialog-description' : undefined"
            tabindex="-1"
        >
          <div
              v-if="showHeader"
              class="flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass)_76%,transparent)] px-5 py-4 md:px-6"
          >
            <div class="min-w-0">
              <h2
                  v-if="title"
                  id="dialog-title"
                  class="text-lg font-semibold tracking-[-0.02em] text-[var(--color-text)]"
              >
                {{ title }}
              </h2>
              <p
                  v-if="description"
                  id="dialog-description"
                  class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]"
              >
                {{ description }}
              </p>
            </div>

            <IconButton
              ariaLabel="Close dialog"
              variant="ghost"
              size="sm"
              class="!border-transparent !bg-transparent !shadow-none hover:!border-transparent hover:!bg-transparent"
              @click="close"
            >
              <Icon name="close" :size="16" />
            </IconButton>
          </div>

          <div class="overflow-y-auto px-5 py-5 md:px-6">
            <slot />
          </div>

          <div
              v-if="$slots.footer"
              class="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass)_74%,transparent)] px-5 py-4 md:px-6"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
