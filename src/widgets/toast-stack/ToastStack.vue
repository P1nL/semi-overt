<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'

import { ToastHost } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import type { ToastItem } from '@/shared/components/base'

const toast = useToast()

// Use the mounted application's state, including after Vite hot updates.
if (import.meta.env.DEV) {
  const debugWindow = window as Window & {
    testToast?: (message?: string, duration?: number) => number
  }
  const testToast = (message = '上传失败，请稍后重试', duration = 5000) =>
      toast.error(message, { duration })
  onMounted(() => { debugWindow.testToast = testToast })
  onBeforeUnmount(() => {
    if (debugWindow.testToast === testToast) delete debugWindow.testToast
  })
}

const hostToasts = computed(() =>
    toast.toasts.value.map((item): ToastItem => {
      let variant: ToastItem['variant'] = 'info'

      if (item.type === 'success') variant = 'success'
      if (item.type === 'warning') variant = 'warning'
      if (item.type === 'error') variant = 'danger'

      return {
        id: item.id,
        title: item.title,
        description: item.message,
        duration: item.duration,
        variant,
        closable: true,
      }
    }),
)
</script>

<template>
  <ToastHost
      :toasts="hostToasts"
      position="bottom-right"
      :max="3"
      @remove="toast.remove(Number($event))"
  />
</template>
