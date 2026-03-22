<script setup lang="ts">
import { cn } from '@/shared/utils/cn'
import Container from './Container.vue'

interface Props {
  as?: keyof HTMLElementTagNameMap
  contained?: boolean
  surface?: boolean
  spacious?: boolean
  class?: string
  containerClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'section',
  contained: true,
  surface: false,
  spacious: false,
  class: '',
  containerClass: '',
})
</script>

<template>
  <component
      :is="props.as"
      :class="
            cn(
                props.spacious ? 'py-12 md:py-16 lg:py-20' : 'py-8 md:py-10 lg:py-12',
                props.surface && 'surface-1 rounded-[var(--radius-xl)]',
                props.surface && (props.spacious ? 'px-5 py-6 md:px-8 md:py-8' : 'px-4 py-5 md:px-6 md:py-6'),
                props.class,
            )
        "
  >
    <Container v-if="props.contained" :class="props.containerClass">
      <slot />
    </Container>

    <slot v-else />
  </component>
</template>
