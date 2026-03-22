<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'

interface Props {
  content?: string
  as?: keyof HTMLElementTagNameMap
  emptyText?: string
  proseClass?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  as: 'div',
  emptyText: '',
  proseClass: '',
  class: '',
})

const isEmpty = computed(() => !props.content?.trim())
</script>

<template>
  <component :is="props.as" :class="cn(props.class)">
    <div
        v-if="!isEmpty"
        :class="cn('prose max-w-none', props.proseClass)"
        v-html="props.content"
    />

    <p v-else-if="props.emptyText" class="text-sm text-muted">
      {{ props.emptyText }}
    </p>

    <slot v-else name="empty" />
  </component>
</template>