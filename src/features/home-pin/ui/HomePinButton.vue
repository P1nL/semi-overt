<script setup lang="ts">
import { computed } from 'vue'
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/stores/auth'
import { homeApi } from '@/shared/api/modules/home'
import { queryKeys } from '@/shared/api/queryKeys'
import { AnimatedBowlingIcon } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import { getErrorMessage } from '@/shared/utils/error'

const props = defineProps<{ articleId: number; pinned: boolean }>()
const auth = useAuthStore()
const queryClient = useQueryClient()
const toast = useToast()
const mutationKey = computed(() => ['home-pin', props.articleId])
const pendingCount = useIsMutating({ mutationKey })
const busy = computed(() => pendingCount.value > 0)
const label = computed(() => props.pinned ? '取消首页置顶' : '置顶到首页')
const mutation = useMutation({
  mutationKey,
  mutationFn: (pinned: boolean) => homeApi.setHomePin(props.articleId, pinned),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.home })
  },
  onError: (error: unknown) => {
    toast.error(getErrorMessage(error, '置顶设置失败，请重试'))
  },
})

function togglePin() {
  if (!auth.isAdmin || busy.value) return
  mutation.mutate(!props.pinned)
}
</script>

<template>
  <button
    v-if="auth.isAdmin && articleId > 0"
    type="button"
    class="home-pin-button"
    :class="{ 'home-pin-button--pinned': pinned }"
    data-home-pin-action
    :data-article-id="articleId"
    :disabled="busy"
    :aria-label="label"
    :aria-pressed="pinned"
    :aria-busy="busy"
    :title="busy ? '正在保存置顶设置' : label"
    @click.stop.prevent="togglePin"
    @keydown.stop
  >
    <AnimatedBowlingIcon />
  </button>
</template>

<style scoped>
.home-pin-button {
  position: absolute;
  inset-block-start: clamp(0.9rem, 2vw, 1.35rem);
  inset-inline-end: clamp(0.9rem, 2vw, 1.35rem);
  z-index: 2;
  display: grid;
  place-items: center;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--card-foreground);
  cursor: pointer;
  transition: background-color 180ms ease, color 180ms ease;
}

.home-pin-button:hover {
  background: color-mix(in srgb, var(--card-foreground) 12%, transparent);
}

.home-pin-button--pinned,
.home-pin-button--pinned:hover {
  background: var(--card-foreground);
  color: var(--card-background);
}

.home-pin-button:focus-visible {
  outline: 2px solid var(--card-foreground);
  outline-offset: 3px;
}

.home-pin-button:disabled {
  cursor: progress;
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .home-pin-button { transition: none; }
}
</style>
