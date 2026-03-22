<script setup lang="ts">
import { Drawer } from '@/shared/components/base'

withDefaults(
    defineProps<{
      modelValue: boolean
      title?: string
      description?: string
    }>(),
    {
      title: '',
      description: '',
    },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()
</script>

<template>
  <Drawer
      :model-value="modelValue"
      :title="title"
      :description="description"
      size="full"
      placement="right"
      @update:model-value="emit('update:modelValue', $event)"
  >
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </Drawer>
</template>

