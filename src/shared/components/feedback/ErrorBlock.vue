<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
import { Button } from '@/shared/components/base'
import { cn } from '@/shared/utils/cn'

interface Props {
  title?: string
  message?: string
  retryText?: string
  compact?: boolean
  bordered?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '加载失败',
  message: '出现了一些问题，请稍后重试。',
  retryText: '重试',
  compact: false,
  bordered: true,
})

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div
      :class="
            cn(
                'rounded-[var(--radius-md)]',
                props.bordered && 'surface-1',
                props.compact ? 'p-3' : 'p-5',
                props.class,
            )
        "
      role="alert"
      aria-live="polite"
  >
    <div class="flex items-start gap-3">
      <div
          class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style="background: color-mix(in srgb, var(--color-danger) 12%, transparent); color: var(--color-danger)"
      >
        <AlertCircle class="h-5 w-5" />
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">{{ props.title }}</p>
        <p v-if="props.message" class="mt-1 text-sm text-muted">
          {{ props.message }}
        </p>

        <div v-if="$slots.default" class="mt-3">
          <slot />
        </div>

        <div v-if="$slots.actions || retryText" class="mt-4 flex flex-wrap items-center gap-2">
          <slot name="actions">
            <Button size="sm" variant="secondary" @click="emit('retry')">
              {{ props.retryText }}
            </Button>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>