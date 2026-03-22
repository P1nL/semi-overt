<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'

type SpinnerSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
    defineProps<{
      size?: SpinnerSize
      label?: string
    }>(),
    {
      size: 'md',
      label: 'Loading',
    },
)

const sizeClassMap: Record<SpinnerSize, string> = {
  sm: 'size-4 border-2',
  md: 'size-5 border-2',
  lg: 'size-7 border-[3px]',
}

const srLabel = computed(() => props.label || 'Loading')
</script>

<template>
  <span class="inline-flex items-center justify-center">
    <span
        :class="
        cn(
          'inline-block animate-spin rounded-full border-current border-r-transparent text-current',
          sizeClassMap[size],
        )
      "
        aria-hidden="true"
    />
    <span class="sr-only">{{ srLabel }}</span>
  </span>
</template>