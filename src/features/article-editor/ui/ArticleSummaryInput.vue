<script setup lang="ts">
import { computed } from 'vue'

import { Textarea } from '@/shared/components/base'
import { FormField } from '@/shared/components/form'
import { ARTICLE_SUMMARY_MAX_LENGTH } from '@/shared/constants/article'

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
      label: '摘要',
      placeholder: '请输入摘要（可选）',
      maxlength: ARTICLE_SUMMARY_MAX_LENGTH,
    },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  change: [string]
}>()

const countText = computed(() => `${props.modelValue.length}/${props.maxlength}`)

function onInput(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <FormField :label="label" :error="error">
    <Textarea
        :model-value="modelValue"
        :disabled="disabled"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :invalid="Boolean(error)"
        :rows="3"
        resize="auto"
        @update:model-value="onInput"
    />
    <p class="text-xs text-[var(--color-text-muted)]">{{ countText }}</p>
  </FormField>
</template>

