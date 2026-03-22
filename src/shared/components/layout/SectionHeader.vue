<script setup lang="ts">
import { cn } from '@/shared/utils/cn'

interface Props {
  title?: string
  description?: string
  align?: 'left' | 'center'
  compact?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  align: 'left',
  compact: false,
  class: '',
})
</script>

<template>
  <header
      :class="
            cn(
                'flex flex-col gap-3',
                props.align === 'center' && 'items-center text-center',
                props.compact ? 'mb-4' : 'mb-6 md:mb-8',
                props.class,
            )
        "
  >
    <div class="min-w-0">
      <div
          v-if="$slots.eyebrow"
          class="mb-3 text-xs font-semibold uppercase tracking-[0.18em]"
          style="color: var(--color-primary)"
      >
        <slot name="eyebrow" />
      </div>

      <h2
          v-if="props.title || $slots.title"
          class="text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)] md:text-3xl"
      >
        <slot name="title">{{ props.title }}</slot>
      </h2>

      <p
          v-if="props.description || $slots.description"
          class="mt-3 max-w-3xl text-sm leading-7 text-muted md:text-base"
      >
        <slot name="description">{{ props.description }}</slot>
      </p>
    </div>

    <div v-if="$slots.actions" class="flex w-full flex-wrap items-center gap-2" :class="props.align === 'center' && 'justify-center'">
      <slot name="actions" />
    </div>
  </header>
</template>
