<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { cn } from '@/shared/utils/cn'
import Icon from './Icon.vue'
import IconButton from './IconButton.vue'

export interface ToastItem {
  id: string | number
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  duration?: number
  closable?: boolean
  actionText?: string
}

type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

const props = withDefaults(
    defineProps<{
      toasts?: ToastItem[]
      position?: ToastPosition
      max?: number
    }>(),
    {
      toasts: () => [],
      position: 'top-right',
      max: 5,
    },
)

const emit = defineEmits<{
  (e: 'update:toasts', value: ToastItem[]): void
  (e: 'remove', id: string | number): void
}>()

const internalToasts = ref<ToastItem[]>([])
const timers = new Map<string | number, number>()

const list = computed(() => {
  const source = props.toasts.length ? props.toasts : internalToasts.value
  return source.slice(0, props.max)
})

const positionClassMap: Record<ToastPosition, string> = {
  'top-right': 'toast-viewport-top-right items-end',
  'top-left': 'toast-viewport-top-left items-start',
  'bottom-right': 'toast-viewport-bottom-right items-end',
  'bottom-left': 'toast-viewport-bottom-left items-start',
}

const variantMeta = {
  default: { icon: 'info', color: 'text-[var(--color-text)]' },
  success: { icon: 'success', color: 'text-[var(--color-success)]' },
  warning: { icon: 'warning', color: 'text-[var(--color-warning)]' },
  danger: { icon: 'error', color: 'text-[var(--color-danger)]' },
  info: { icon: 'info', color: 'text-[var(--color-primary)]' },
} as const

function sync(next: ToastItem[]) {
  if (props.toasts.length) {
    emit('update:toasts', next)
  } else {
    internalToasts.value = next
  }
}

function remove(id: string | number) {
  window.clearTimeout(timers.get(id))
  timers.delete(id)
  sync(list.value.filter((item) => item.id !== id))
  emit('remove', id)
}

function schedule(item: ToastItem) {
  if (item.duration === 0) return
  const duration = item.duration ?? 3000
  const timer = window.setTimeout(() => remove(item.id), duration)
  timers.set(item.id, timer)
}

function push(toast: Omit<ToastItem, 'id'> & { id?: string | number }) {
  const next: ToastItem = {
    id: toast.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    closable: true,
    variant: 'default',
    duration: 3000,
    ...toast,
  }

  const merged = [next, ...list.value].slice(0, props.max)
  sync(merged)
  schedule(next)
}

function clear() {
  Array.from(timers.values()).forEach((timer) => window.clearTimeout(timer))
  timers.clear()
  sync([])
}

function onToastEvent(event: Event) {
  const detail = (event as CustomEvent<Omit<ToastItem, 'id'> & { id?: string | number }>).detail
  if (!detail) return
  push(detail)
}

watch(
    () => props.toasts,
    (items) => {
      items.forEach((item) => {
        if (!timers.has(item.id)) {
          schedule(item)
        }
      })
    },
    { immediate: true, deep: true },
)

onMounted(() => {
  window.addEventListener('app:toast', onToastEvent as EventListener)
})

onBeforeUnmount(() => {
  clear()
  window.removeEventListener('app:toast', onToastEvent as EventListener)
})

defineExpose({
  push,
  remove,
  clear,
})
</script>

<template>
  <Teleport to="body">
    <div
        :class="
        cn(
          'toast-viewport pointer-events-none fixed z-[70] flex flex-col gap-3',
          positionClassMap[position],
        )
      "
        aria-live="polite"
        aria-atomic="true"
    >
      <TransitionGroup
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="translate-y-2 scale-[0.98] opacity-0"
          enter-to-class="translate-y-0 opacity-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="scale-[0.98] opacity-0"
      >
        <div
            v-for="toast in list"
            :key="toast.id"
            class="surface-1 pointer-events-auto flex w-fit max-w-full items-center gap-2.5 rounded-[var(--radius-pill)] px-3.5 shadow-[var(--shadow-lg)]"
            :class="toast.title || $slots.action ? 'min-h-9 py-3' : 'h-9 py-0'"
        >
          <span class="flex shrink-0 items-center leading-none" :class="variantMeta[toast.variant ?? 'default'].color">
            <Icon :name="variantMeta[toast.variant ?? 'default'].icon" :size="18" />
          </span>

          <div class="min-w-0 flex-1">
            <p v-if="toast.title" class="text-sm font-semibold leading-none tracking-[-0.01em] text-[var(--color-text)]">
              {{ toast.title }}
            </p>
            <p
                v-if="toast.description"
                class="text-sm text-[var(--color-text-muted)]"
                :class="toast.title ? 'mt-1 leading-6' : 'leading-none'"
            >
              {{ toast.description }}
            </p>

            <button
                v-if="$slots.action"
                type="button"
                class="mt-2 text-sm font-medium text-[var(--color-primary)]"
            >
              <slot name="action" :toast="toast" />
            </button>
          </div>

          <IconButton
              v-if="toast.closable !== false"
              ariaLabel="Dismiss toast"
              variant="ghost"
              size="sm"
              @click="remove(toast.id)"
          >
            <Icon name="close" :size="14" />
          </IconButton>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-viewport {
  width: fit-content;
  max-width: min(calc(100vw - 1.5rem), 17rem);
}

.toast-viewport-top-right {
  top: 1.6rem;
  right: 1.5rem;
}

.toast-viewport-top-left {
  top: 1.25rem;
  left: max(0.75rem, calc((100vw - min(calc(100vw - 1.5rem), 1200px)) / 2 + 1rem));
}

.toast-viewport-bottom-right {
  bottom: 1rem;
  right: 1rem;
}

.toast-viewport-bottom-left {
  bottom: 1rem;
  left: max(0.75rem, calc((100vw - min(calc(100vw - 1.5rem), 1200px)) / 2 + 1rem));
}
</style>
