<script setup lang="ts">
import { computed } from 'vue'

import { ToastHost } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import type { ToastItem } from '@/shared/components/base'

const toast = useToast()

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
      position="top-right"
      @remove="toast.remove(Number($event))"
  />
</template>
