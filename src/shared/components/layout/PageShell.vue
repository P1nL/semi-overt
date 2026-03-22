<script setup lang="ts">
import { cn } from '@/shared/utils/cn'
import Container from './Container.vue'

interface Props {
  as?: keyof HTMLElementTagNameMap
  contained?: boolean
  class?: string
  bodyClass?: string
  containerClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'main',
  contained: true,
  class: '',
  bodyClass: '',
  containerClass: '',
})
</script>

<template>
  <component
      :is="props.as"
      :class="cn('min-h-[calc(100vh-4.5rem)] py-8 md:py-12 lg:py-16', props.class)"
  >
    <Container v-if="props.contained" :class="props.containerClass">
      <div :class="cn('space-y-8 md:space-y-10 lg:space-y-12', props.bodyClass)">
        <slot />
      </div>
    </Container>

    <div v-else :class="cn('space-y-8 md:space-y-10 lg:space-y-12', props.bodyClass)">
      <slot />
    </div>
  </component>
</template>
