<script setup lang="ts">
import { computed } from 'vue'

import { Textarea } from '@/shared/components/base'
import { FormField } from '@/shared/components/form'
import { REVIEW_REASON_MAX_LENGTH } from '@/shared/constants/review'

const props = withDefaults(
    defineProps<{
      modelValue?: string
      error?: string
      disabled?: boolean
      required?: boolean
      label?: string
      placeholder?: string
      maxlength?: number
    }>(),
    {
      modelValue: '',
      error: '',
      disabled: false,
      required: false,
      label: '处理原因',
      placeholder: '请填写审核原因',
      maxlength: REVIEW_REASON_MAX_LENGTH,
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
  <FormField :label="required ? `${label}（必填）` : label" :error="error">
    <Textarea
        :model-value="modelValue"
        :disabled="disabled"
        :invalid="Boolean(error)"
        :maxlength="maxlength"
        :rows="4"
        resize="auto"
        :placeholder="placeholder"
        @update:model-value="onInput"
    />
    <p class="text-xs text-[var(--color-text-muted)]">{{ countText }}</p>
  </FormField>
</template>

