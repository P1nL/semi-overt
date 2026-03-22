<script setup lang="ts">
import { computed } from 'vue'

import type { ProfileArticleTab } from '@/stores/profile'

const props = withDefaults(
  defineProps<{
    modelValue: ProfileArticleTab
    counts?: Partial<Record<ProfileArticleTab, number>>
    publicOnly?: boolean
  }>(),
  {
    counts: () => ({}),
    publicOnly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [ProfileArticleTab]
  change: [ProfileArticleTab]
}>()

const tabItems = computed(() => {
  if (props.publicOnly) {
    return [
      { label: '已发布', value: 'approved' as const, badge: props.counts.approved ?? 0 },
    ]
  }

  return [
    { label: '全部', value: 'all' as const, badge: props.counts.all ?? 0 },
    { label: '已发布', value: 'approved' as const, badge: props.counts.approved ?? 0 },
    { label: '审核中', value: 'pending' as const, badge: props.counts.pending ?? 0 },
    { label: '已退回', value: 'returned' as const, badge: props.counts.returned ?? 0 },
    { label: '已拒绝', value: 'rejected' as const, badge: props.counts.rejected ?? 0 },
    { label: '草稿', value: 'draft' as const, badge: props.counts.draft ?? 0 },
  ]
})

function selectTab(value: ProfileArticleTab) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <div
    class="flex items-center gap-2 overflow-x-auto rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_72%,transparent)] p-1"
    role="tablist"
  >
    <button
      v-for="item in tabItems"
      :key="item.value"
      type="button"
      role="tab"
      :aria-selected="item.value === modelValue"
      class="flex min-w-fit flex-1 items-center justify-center gap-2 rounded-[calc(var(--radius-lg)-0.25rem)] px-4 py-2 text-sm font-medium tracking-[-0.01em] whitespace-nowrap transition-all duration-200"
      :class="
        item.value === modelValue
          ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-xs)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      "
      @click="selectTab(item.value)"
    >
      <span>{{ item.label }}</span>
      <span class="text-[11px] opacity-80">
        {{ item.badge }}
      </span>
    </button>
  </div>
</template>
