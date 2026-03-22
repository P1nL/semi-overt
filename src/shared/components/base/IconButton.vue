<script setup lang="ts">
import { useAttrs } from 'vue'
import Button from './Button.vue'

type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type IconButtonSize = 'sm' | 'md' | 'lg'

defineOptions({
  inheritAttrs: false,
})

withDefaults(
    defineProps<{
      type?: 'button' | 'submit' | 'reset'
      variant?: IconButtonVariant
      size?: IconButtonSize
      loading?: boolean
      disabled?: boolean
      pill?: boolean
      ariaLabel: string
    }>(),
    {
      type: 'button',
      variant: 'ghost',
      size: 'md',
      loading: false,
      disabled: false,
      pill: false,
    },
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const attrs = useAttrs()
</script>

<template>
  <Button
      v-bind="attrs"
      :type="type"
      icon-only
      :variant="variant"
      :size="size"
      :loading="loading"
      :disabled="disabled"
      :pill="pill"
      :aria-label="ariaLabel"
      @click="emit('click', $event)"
  >
    <slot />
  </Button>
</template>
