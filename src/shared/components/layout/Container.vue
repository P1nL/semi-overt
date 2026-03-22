<script setup lang="ts">
import { cn } from '@/shared/utils/cn'

interface Props {
  as?: keyof HTMLElementTagNameMap
  narrow?: boolean
  wide?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'div',
  narrow: false,
  wide: false,
  class: '',
})
</script>

<template>
  <component
      :is="props.as"
      :class="
            cn(
                'page-container w-full',
                props.narrow && 'max-w-[52rem]',
                props.wide && 'max-w-[82rem]',
                props.class,
            )
        "
  >
    <slot />
  </component>
</template>
