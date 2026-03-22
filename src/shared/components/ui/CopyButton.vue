<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy } from 'lucide-vue-next'
import { Button } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'

interface Props {
  text?: string
  successText?: string
  errorText?: string
  toast?: boolean
  resetAfter?: number
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  successText: '已复制到剪贴板',
  errorText: '复制失败，请手动复制',
  toast: true,
  resetAfter: 1600,
  disabled: false,
})

const emit = defineEmits<{
  copied: [text: string]
  error: [error: unknown]
}>()

const copied = ref(false)
const toast = useToast()

const canCopy = computed(() => Boolean(props.text) && !props.disabled)

let resetTimer: number | null = null

async function handleCopy() {
  if (!canCopy.value) return

  try {
    await navigator.clipboard.writeText(props.text)

    copied.value = true
    emit('copied', props.text)

    if (props.toast) {
      toast.success(props.successText)
    }

    if (resetTimer) {
      window.clearTimeout(resetTimer)
    }

    resetTimer = window.setTimeout(() => {
      copied.value = false
    }, props.resetAfter)
  } catch (error) {
    emit('error', error)

    if (props.toast) {
      toast.error(props.errorText)
    }
  }
}
</script>

<template>
  <Button
      type="button"
      variant="secondary"
      size="sm"
      :disabled="!canCopy"
      :aria-label="copied ? '已复制' : '复制内容'"
      @click="handleCopy"
  >
    <Check v-if="copied" class="mr-1.5 h-4 w-4" />
    <Copy v-else class="mr-1.5 h-4 w-4" />
    {{ copied ? '已复制' : '复制' }}
  </Button>
</template>