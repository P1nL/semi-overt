<script setup lang="ts">
import { computed } from 'vue'

import { Button } from '@/shared/components/base'

const props = withDefaults(
    defineProps<{
      url?: string | null
      alt?: string
      color?: string | null
      removable?: boolean
      emptyText?: string
    }>(),
    {
      url: null,
      alt: '上传预览',
      color: null,
      removable: true,
      emptyText: '暂无图片',
    },
)

const emit = defineEmits<{
  remove: []
}>()

const backgroundStyle = computed(() => ({
  background: props.color || 'var(--color-surface-elevated)',
}))
</script>

<template>
  <div class="space-y-2">
    <div
        class="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]"
        :style="backgroundStyle"
    >
      <img
          v-if="url"
          :src="url"
          :alt="alt"
          class="h-40 w-full object-cover"
      />
      <div
          v-else
          class="flex h-40 w-full items-center justify-center text-sm text-[var(--color-text-muted)]"
      >
        {{ emptyText }}
      </div>
    </div>

    <Button
        v-if="url && removable"
        type="button"
        size="sm"
        variant="ghost"
        @click="emit('remove')"
    >
      移除图片
    </Button>
  </div>
</template>

