<script setup lang="ts">
import { Button } from '@/shared/components/base'
import AnimatedUploadFileIcon from '@/shared/components/base/AnimatedUploadFileIcon.vue'
withDefaults(defineProps<{
  label?: string
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
}>(), { label: '上传图片', loading: false, disabled: false, variant: 'secondary' })
defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <Button
    type="button"
    :variant="variant"
    :loading="loading"
    :disabled="disabled || loading"
    :aria-label="loading ? label + '中' : label"
    :class="['image-upload-button', variant === 'secondary' && 'image-upload-button--secondary']"
    icon-only
    @click="$emit('click', $event)"
  >
    <AnimatedUploadFileIcon size="1.1rem" :decorative="true" />
  </Button>
</template>

<style scoped>
.image-upload-button {
  width: 3.5rem;
  border-radius: var(--radius-lg);
}

.image-upload-button.image-upload-button--secondary {
  border-color: color-mix(in srgb, var(--color-border) 74%, transparent);
  background: color-mix(in srgb, var(--color-surface-elevated) 84%, transparent);
  color: var(--color-text-muted);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.image-upload-button.image-upload-button--secondary:hover {
  border-color: color-mix(in srgb, var(--color-border-strong) 82%, transparent);
  background: color-mix(in srgb, var(--color-surface-elevated) 92%, transparent);
  color: var(--color-text);
  box-shadow:
    0 8px 18px rgb(15 23 42 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

.image-upload-button.image-upload-button--secondary:active {
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
}
</style>

