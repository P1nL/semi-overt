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
      position: 'bottom-right',
      max: 3,
    },
)

const emit = defineEmits<{
  (e: 'update:toasts', value: ToastItem[]): void
  (e: 'remove', id: string | number): void
  (e: 'action', id: string | number): void
}>()

const internalToasts = ref<ToastItem[]>([])
const timers = new Map<string | number, number>()
const remaining = new Map<string | number, number>()
const startedAt = new Map<string | number, number>()
const hovered = new Set<string | number>()
const focused = new Set<string | number>()

const list = computed(() => {
  const source = props.toasts ?? internalToasts.value
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
  if (props.toasts !== undefined) {
    emit('update:toasts', next)
  } else {
    internalToasts.value = next
  }
}

function remove(id: string | number) {
  window.clearTimeout(timers.get(id))
  timers.delete(id)
  remaining.delete(id)
  startedAt.delete(id)
  hovered.delete(id)
  focused.delete(id)
  sync(list.value.filter((item) => item.id !== id))
  emit('remove', id)
}

function schedule(item: ToastItem) {
  if (item.duration === 0) return
  const duration = remaining.get(item.id) ?? item.duration ?? 5000
  remaining.set(item.id, duration)
  startedAt.set(item.id, performance.now())
  const timer = window.setTimeout(() => remove(item.id), duration)
  timers.set(item.id, timer)
}

function pause(id: string | number, kind: 'pointer' | 'focus') {
  ;(kind === 'pointer' ? hovered : focused).add(id)
  if (!timers.has(id)) return
  window.clearTimeout(timers.get(id))
  timers.delete(id)
  remaining.set(id, Math.max(0, (remaining.get(id) ?? 5000) - (performance.now() - (startedAt.get(id) ?? performance.now()))))
}

function resume(item: ToastItem, kind: 'pointer' | 'focus', event?: FocusEvent) {
  if (event?.relatedTarget instanceof Node && (event.currentTarget as HTMLElement).contains(event.relatedTarget)) return
  ;(kind === 'pointer' ? hovered : focused).delete(item.id)
  if (!hovered.has(item.id) && !focused.has(item.id) && !timers.has(item.id)) schedule(item)
}

function beforeLeave(element: Element) {
  const el = element as HTMLElement
  const rect = el.getBoundingClientRect()
  // Freeze the departing item in its current slot, then travel beyond the viewport.
  el.style.top = `${el.offsetTop}px`
  el.style.width = `${el.offsetWidth}px`
  el.style.setProperty('--toast-exit-y', `${window.innerHeight - rect.top + 32}px`)
  el.style.pointerEvents = 'none'
  el.setAttribute('aria-hidden', 'true')
  el.inert = true
}

function push(toast: Omit<ToastItem, 'id'> & { id?: string | number }) {
  const next: ToastItem = {
    id: toast.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    closable: true,
    variant: 'default',
    duration: 5000,
    ...toast,
  }

  const merged = [next, ...list.value].slice(0, props.max)
  sync(merged)
}

function clear() {
  Array.from(timers.values()).forEach((timer) => window.clearTimeout(timer))
  timers.clear()
  remaining.clear()
  startedAt.clear()
  hovered.clear()
  focused.clear()
  sync([])
}

function onToastEvent(event: Event) {
  const detail = (event as CustomEvent<Omit<ToastItem, 'id'> & { id?: string | number }>).detail
  if (!detail) return
  push(detail)
}

watch(
    list,
    (items) => {
      for (const id of remaining.keys()) {
        if (!items.some((item) => item.id === id)) {
          window.clearTimeout(timers.get(id))
          timers.delete(id)
          remaining.delete(id)
          startedAt.delete(id)
          hovered.delete(id)
          focused.delete(id)
        }
      }
      items.forEach((item) => {
        if (!remaining.has(item.id)) {
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
          'toast-viewport pointer-events-none fixed grid',
          positionClassMap[position],
        )
      "
        aria-live="polite"
        aria-label="操作失败提示"
    >
      <TransitionGroup
          name="toast"
          move-class="toast-no-move"
          @before-leave="beforeLeave"
      >
        <div
            v-for="(toast, index) in list"
            :key="toast.id"
            :style="{ '--toast-depth': index, zIndex: max - index }"
            :inert="index > 0"
            :class="{ 'toast-behind': index > 0 }"
            class="toast-item pointer-events-auto flex w-full items-center gap-2.5 px-3.5 py-2.5"
            @mouseenter="pause(toast.id, 'pointer')"
            @mouseleave="resume(toast, 'pointer')"
            @focusin="pause(toast.id, 'focus')"
            @focusout="resume(toast, 'focus', $event)"
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
                class="text-sm leading-5 text-[var(--color-text)] break-words"
                :class="toast.title ? 'mt-1' : ''"
            >
              {{ toast.description }}
            </p>

            <button
                v-if="toast.actionText || $slots.action"
                type="button"
                class="mt-2 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-strong)]"
                @click="emit('action', toast.id)"
            >
              <slot name="action" :toast="toast">{{ toast.actionText }}</slot>
            </button>
          </div>

          <IconButton
              v-if="toast.closable !== false"
              ariaLabel="关闭提示"
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
  z-index: 2147483647;
  width: min(calc(100vw - 2rem), 320px);
  /* Cards share one slot; reserve only the two exposed lower edges. */
  margin-bottom: 20px;
}

.toast-item {
  grid-area: 1 / 1;
  min-height: 56px;
  max-height: min(160px, calc(100dvh - 80px - env(safe-area-inset-bottom)));
  transform-origin: center bottom;
  transform: translateY(calc(var(--toast-depth) * 10px)) scaleX(calc(1 - var(--toast-depth) * 0.04));
  transition: transform 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms ease;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: min(var(--radius-md), 14px);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.toast-behind > * {
  visibility: hidden;
}
.toast-behind {
  pointer-events: none;
}
.toast-no-move {
  transition: none !important;
}
.toast-enter-active {
  transition: transform 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms ease;
}
.toast-enter-from {
  transform: translateX(calc(100% + 40px + env(safe-area-inset-right)));
  opacity: 0;
}
.toast-leave-active {
  position: absolute;
  transition: transform 180ms ease-in;
}
.toast-leave-to {
  transform: translateY(var(--toast-exit-y)) scaleX(calc(1 - var(--toast-depth) * 0.04));
}
@media (prefers-reduced-motion: reduce) {
  .toast-item, .toast-enter-active, .toast-leave-active {
    transition: none;
  }
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
  bottom: max(16px, env(safe-area-inset-bottom));
  right: max(24px, env(safe-area-inset-right));
}

@media (max-width: 640px) {
  .toast-viewport-bottom-right {
    bottom: max(16px, env(safe-area-inset-bottom));
    right: max(16px, env(safe-area-inset-right));
  }
}

.toast-viewport-bottom-left {
  bottom: 1rem;
  left: max(0.75rem, calc((100vw - min(calc(100vw - 1.5rem), 1200px)) / 2 + 1rem));
}
</style>
