<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, CheckCircle2, FileSearch, Info, TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/shared/components/base'
import { cn } from '@/shared/utils/cn'

type ResultTone = 'default' | 'success' | 'warning' | 'error' | 'info'

interface Props {
  tone?: ResultTone
  title: string
  description?: string
  actionText?: string
  secondaryActionText?: string
  compact?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'default',
  description: '',
  actionText: '',
  secondaryActionText: '',
  compact: false,
})

const emit = defineEmits<{
  action: []
  secondaryAction: []
}>()

const toneConfig = computed(() => {
  switch (props.tone) {
    case 'success':
      return {
        icon: CheckCircle2,
        color: 'var(--color-success)',
        background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
      }
    case 'warning':
      return {
        icon: TriangleAlert,
        color: 'var(--color-warning)',
        background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
      }
    case 'error':
      return {
        icon: AlertCircle,
        color: 'var(--color-danger)',
        background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
      }
    case 'info':
      return {
        icon: Info,
        color: 'var(--color-primary)',
        background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
      }
    default:
      return {
        icon: FileSearch,
        color: 'var(--color-primary)',
        background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
      }
  }
})
</script>

<template>
  <section
      :class="
            cn(
                'surface-1 rounded-[var(--radius-lg)] text-center',
                props.compact ? 'px-5 py-8' : 'px-6 py-10 md:px-10 md:py-14',
                props.class,
            )
        "
  >
    <div
        class="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
        :style="{ background: toneConfig.background, color: toneConfig.color }"
    >
      <component :is="toneConfig.icon" class="h-7 w-7" />
    </div>

    <h2 class="mt-4 text-lg font-semibold md:text-xl">{{ props.title }}</h2>

    <p v-if="props.description" class="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted md:text-base">
      {{ props.description }}
    </p>

    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>

    <div
        v-if="$slots.actions || props.actionText || props.secondaryActionText"
        class="mt-6 flex flex-wrap items-center justify-center gap-3"
    >
      <slot name="actions">
        <Button
            v-if="props.secondaryActionText"
            variant="secondary"
            @click="emit('secondaryAction')"
        >
          {{ props.secondaryActionText }}
        </Button>

        <Button v-if="props.actionText" @click="emit('action')">
          {{ props.actionText }}
        </Button>
      </slot>
    </div>
  </section>
</template>