<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'
import FormHint from './FormHint.vue'
import FormLabel from './FormLabel.vue'
import FieldError from './FieldError.vue'

interface Props {
  label?: string
  for?: string
  hint?: string
  error?: string
  required?: boolean
  optional?: boolean
  horizontal?: boolean
  class?: string
  contentClass?: string
  labelClass?: string
  hintId?: string
  errorId?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  for: '',
  hint: '',
  error: '',
  required: false,
  optional: false,
  horizontal: false,
  class: '',
  contentClass: '',
  labelClass: '',
  hintId: '',
  errorId: '',
})

const describedBy = computed(() => {
  const ids = [props.hint ? props.hintId : '', props.error ? props.errorId : ''].filter(Boolean)
  return ids.join(' ') || undefined
})
</script>

<template>
  <div
      :class="
            cn(
                'w-full',
                props.horizontal ? 'grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4' : 'space-y-2',
                props.class,
            )
        "
  >
    <div v-if="props.label || $slots.label" class="min-w-0">
      <slot name="label">
        <FormLabel
            :for="props.for"
            :required="props.required"
            :optional="props.optional"
            :class="props.labelClass"
        >
          {{ props.label }}
        </FormLabel>
      </slot>
    </div>

    <div :class="cn('min-w-0 space-y-2', props.contentClass)">
      <div :aria-describedby="describedBy">
        <slot />
      </div>

      <FormHint v-if="props.hint || $slots.hint" :id="props.hintId">
        <slot name="hint">{{ props.hint }}</slot>
      </FormHint>

      <FieldError v-if="props.error || $slots.error" :id="props.errorId" :message="props.error">
        <slot name="error">{{ props.error }}</slot>
      </FieldError>
    </div>
  </div>
</template>