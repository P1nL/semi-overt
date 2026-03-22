<script setup lang="ts">
import { ref, watch } from 'vue'

import { Button, Input } from '@/shared/components/base'

const props = withDefaults(
    defineProps<{
      modelValue?: string
      loading?: boolean
      placeholder?: string
    }>(),
    {
      modelValue: '',
      loading: false,
      placeholder: '搜索文章',
    },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  search: [string]
}>()

const keyword = ref(props.modelValue)

watch(
    () => props.modelValue,
    (value) => {
      keyword.value = value
    },
)

function submitSearch() {
  const normalized = keyword.value.trim()
  emit('update:modelValue', keyword.value)
  emit('search', normalized)
}
</script>

<template>
  <div class="surface-2 flex items-center gap-2 rounded-[var(--radius-xl)] p-2">
    <Input
        v-model="keyword"
        :placeholder="placeholder"
        class="border-none bg-transparent shadow-none"
        clearable
        @enter="submitSearch"
    />
    <Button type="button" pill :loading="loading" @click="submitSearch">
      搜索
    </Button>
  </div>
</template>
