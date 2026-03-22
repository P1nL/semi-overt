<script setup lang="ts">
import { computed } from 'vue'

import { Input } from '@/shared/components/base'
import { FormField } from '@/shared/components/form'
import { ARTICLE_TITLE_MAX_LENGTH } from '@/shared/constants/article'

const props = withDefaults(
    defineProps<{
      modelValue?: string
      disabled?: boolean
      error?: string
      label?: string
      placeholder?: string
      maxlength?: number
    }>(),
    {
      modelValue: '',
      disabled: false,
      error: '',
      label: '标题',
      placeholder: '请输入文章标题',
      maxlength: ARTICLE_TITLE_MAX_LENGTH,
    },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  change: [string]
  blur: [FocusEvent]
}>()

const countText = computed(() => `${props.modelValue.length}/${props.maxlength}`)

function onInput(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <FormField :label="label" :error="error">
    <Input
        :model-value="modelValue"
        :disabled="disabled"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :invalid="Boolean(error)"
        @update:model-value="onInput"
        @blur="emit('blur', $event)"
    />
    <p class="text-xs text-[var(--color-text-muted)]">{{ countText }}</p>
  </FormField>
</template>

