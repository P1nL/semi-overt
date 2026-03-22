<script setup lang="ts">
import { cn } from '@/shared/utils/cn'

interface Props {
  as?: keyof HTMLElementTagNameMap
  focusable?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'span',
  focusable: false,
  class: '',
})
</script>

<template>
  <component
      :is="props.as"
      :class="
            cn(
                props.focusable
                    ? 'sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:outline-none'
                    : 'sr-only',
                props.class,
            )
        "
  >
    <slot />
  </component>
</template>