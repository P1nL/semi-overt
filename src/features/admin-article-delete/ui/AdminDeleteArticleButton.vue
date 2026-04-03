<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { Button } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import { getErrorMessage } from '@/shared/utils/error'
import {
  adminDeleteArticleById,
  type AdminArticleDeleteResult,
} from '@/features/admin-article-delete/model'

const props = withDefaults(
  defineProps<{
    articleId: number | string
    disabled?: boolean
    text?: string
    buttonVariant?: 'danger' | 'ghost' | 'secondary'
    confirmText?: string
  }>(),
  {
    disabled: false,
    text: '管理员删除',
    buttonVariant: 'danger',
    confirmText: '确认删除',
  },
)

const emit = defineEmits<{
  deleted: [AdminArticleDeleteResult]
}>()

const toast = useToast()
const rootRef = ref<HTMLElement | null>(null)
const confirming = ref(false)
const loading = ref(false)

const effectiveVariant = computed((): 'warning' => 'warning')

let confirmTimer: ReturnType<typeof setTimeout> | null = null

function clearConfirmTimer() {
  if (!confirmTimer) return
  clearTimeout(confirmTimer)
  confirmTimer = null
}

function resetConfirm() {
  confirming.value = false
  clearConfirmTimer()
}

function armConfirmTimeout() {
  clearConfirmTimer()
  confirmTimer = setTimeout(() => {
    confirming.value = false
  }, 3000)
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    resetConfirm()
  }
}

async function handleDelete() {
  if (props.disabled || loading.value) return

  if (!confirming.value) {
    confirming.value = true
    armConfirmTimeout()
    return
  }

  loading.value = true

  try {
    const result = await adminDeleteArticleById(props.articleId)
    emit('deleted', result)
    toast.success('文章已由管理员删除')
    resetConfirm()
  } catch (error) {
    toast.error(getErrorMessage(error, '删除失败，请稍后重试'))
    resetConfirm()
  } finally {
    loading.value = false
  }
}

watch(confirming, (value) => {
  if (typeof window === 'undefined') return

  if (value) {
    window.addEventListener('keydown', handleWindowKeydown)
    return
  }

  window.removeEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  clearConfirmTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleWindowKeydown)
  }
})

onClickOutside(rootRef, () => {
  if (!confirming.value || loading.value) return
  resetConfirm()
})
</script>

<template>
  <div ref="rootRef" class="inline-flex">
    <Button
      type="button"
      :variant="effectiveVariant"
      :loading="loading"
      :disabled="disabled"
      class="admin-delete-button"
      @click="handleDelete"
    >
      <Transition name="admin-delete-label" mode="out-in">
        <span
          :key="confirming ? 'confirm' : 'default'"
          class="admin-delete-button__label"
        >
          {{ confirming ? confirmText : text }}
        </span>
      </Transition>
    </Button>
  </div>
</template>

<style scoped>
.admin-delete-button {
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 220ms ease,
    border-color 220ms ease,
    color 220ms ease;
  background: var(--color-warning);
  color: white;
  border-color: transparent;
  box-shadow: 0 14px 28px rgb(185 107 0 / 0.18);
}

.admin-delete-button__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.25rem;
  white-space: nowrap;
}

.admin-delete-label-enter-active,
.admin-delete-label-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 180ms ease;
}

.admin-delete-label-enter-from {
  opacity: 0;
  transform: translateY(7px) scale(0.94);
  filter: blur(4px);
}

.admin-delete-label-leave-to {
  opacity: 0;
  transform: translateY(-7px) scale(1.04);
  filter: blur(4px);
}

.admin-delete-label-enter-to,
.admin-delete-label-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
</style>
