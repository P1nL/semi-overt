<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'

import {
  canReviewArticle,
  submitReviewActionByArticleId,
  validateReviewActionForm,
} from '@/features/review-action/model'
import type { ReviewActionResult, ReviewActionValue } from '@/features/review-action/model'
import { queryKeys } from '@/shared/api/queryKeys'
import { Button, Textarea } from '@/shared/components/base'
import { REVIEW_ACTION, REVIEW_REASON_MAX_LENGTH } from '@/shared/constants/review'
import { useToast } from '@/shared/composables/useToast'
import { getErrorMessage } from '@/shared/utils/error'

type ReasonAction = Extract<ReviewActionValue, 'RETURN' | 'REJECT'>
type PopoverPlacement = 'top' | 'bottom'

const REASON_ACTIONS: Array<{
  value: ReasonAction
  label: string
  confirmLabel: string
  placeholder: string
  helperText: string
}> = [
  {
    value: REVIEW_ACTION.RETURN,
    label: '退回修改',
    confirmLabel: '确认退回',
    placeholder: '请填写退回修改原因',
    helperText: '',
  },
  {
    value: REVIEW_ACTION.REJECT,
    label: '拒绝',
    confirmLabel: '确认拒绝',
    placeholder: '请填写拒绝原因',
    helperText: '',
  },
]

const props = withDefaults(
  defineProps<{
    articleId: number | string
    status?: string | null
    disabled?: boolean
  }>(),
  {
    status: null,
    disabled: false,
  },
)

const emit = defineEmits<{
  acted: [ReviewActionResult]
}>()

const toast = useToast()
const queryClient = useQueryClient()

const barRef = ref<HTMLElement | null>(null)
const activeReasonAction = ref<ReasonAction | null>(null)
const approvePending = ref(false)
const loadingAction = ref<ReviewActionValue | null>(null)
const acting = ref(false)
const popoverPlacement = ref<PopoverPlacement>('top')
const actionErrorMessage = ref('')

const triggerRefs = reactive<Record<ReasonAction, HTMLElement | null>>({
  RETURN: null,
  REJECT: null,
})

const reasonDrafts = reactive<Record<ReasonAction, string>>({
  RETURN: '',
  REJECT: '',
})

const reasonErrors = reactive<Record<ReasonAction, string>>({
  RETURN: '',
  REJECT: '',
})

const canAct = computed(() => !props.disabled && !acting.value && canReviewArticle(props.status))
const showProcessedState = computed(() => !canReviewArticle(props.status) && Boolean(props.status))

function setTriggerRef(
  action: ReasonAction,
  element: Element | ComponentPublicInstance | null,
) {
  const target = element instanceof HTMLElement
    ? element
    : element && '$el' in element && element.$el instanceof HTMLElement
      ? element.$el
      : null

  triggerRefs[action] = target
}

function getReasonOption(action: ReasonAction) {
  return REASON_ACTIONS.find((item) => item.value === action)
}

function getActionLabel(action: ReasonAction): string {
  return getReasonOption(action)?.label ?? ''
}

function getConfirmLabel(action: ReasonAction): string {
  return getReasonOption(action)?.confirmLabel ?? ''
}

function getPlaceholder(action: ReasonAction): string {
  return getReasonOption(action)?.placeholder ?? ''
}

function getHelperText(action: ReasonAction): string {
  return getReasonOption(action)?.helperText ?? ''
}

function resetApproveState() {
  approvePending.value = false
}

function clearReasonState(action: ReasonAction) {
  reasonDrafts[action] = ''
  reasonErrors[action] = ''
}

function closeReasonPopover() {
  if (activeReasonAction.value) {
    clearReasonState(activeReasonAction.value)
  }

  activeReasonAction.value = null
  actionErrorMessage.value = ''
}

function resetInteractionState() {
  resetApproveState()
  closeReasonPopover()
}

function syncPopoverPlacement(action: ReasonAction) {
  if (typeof window === 'undefined') {
    popoverPlacement.value = 'top'
    return
  }

  const trigger = triggerRefs[action]
  if (!trigger) {
    popoverPlacement.value = 'top'
    return
  }

  const rect = trigger.getBoundingClientRect()
  const preferredHeight = 260
  const gap = 16

  popoverPlacement.value = rect.top >= preferredHeight + gap ? 'top' : 'bottom'
}

async function openReasonPopover(action: ReasonAction) {
  if (!canAct.value) return

  resetApproveState()
  actionErrorMessage.value = ''

  if (activeReasonAction.value === action) {
    closeReasonPopover()
    return
  }

  if (activeReasonAction.value) {
    clearReasonState(activeReasonAction.value)
  }

  activeReasonAction.value = action
  clearReasonState(action)

  await nextTick()
  syncPopoverPlacement(action)
}

function getReasonTriggerLabel(action: ReasonAction): string {
  return activeReasonAction.value === action ? '待填写原因' : getActionLabel(action)
}

function isReasonConfirmDisabled(action: ReasonAction): boolean {
  return !canAct.value || loadingAction.value !== null || !reasonDrafts[action].trim()
}

function handleApproveClick() {
  if (!canAct.value || loadingAction.value) return

  closeReasonPopover()

  if (!approvePending.value) {
    approvePending.value = true
    return
  }

  void submitAction(REVIEW_ACTION.APPROVE)
}

function handleReasonInput(action: ReasonAction, value: string) {
  reasonDrafts[action] = value
  reasonErrors[action] = ''
  actionErrorMessage.value = ''
}

async function submitAction(action: ReviewActionValue) {
  if (!canAct.value) return

  const reason = action === REVIEW_ACTION.RETURN || action === REVIEW_ACTION.REJECT
    ? reasonDrafts[action]
    : ''

  const validation = validateReviewActionForm({
    action,
    reason,
  })

  actionErrorMessage.value = ''

  if (action === REVIEW_ACTION.RETURN || action === REVIEW_ACTION.REJECT) {
    reasonErrors[action] = validation.errors.reason || ''
  }

  if (!validation.valid) return

  loadingAction.value = action
  acting.value = true

  try {
    const result = await submitReviewActionByArticleId(props.articleId, {
      action,
      reason,
    })

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviewPendingRoot,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviewLogs(props.articleId),
      }),
    ])

    emit('acted', result)
    toast.success(`审核${action === REVIEW_ACTION.APPROVE ? '通过' : action === REVIEW_ACTION.RETURN ? '退回' : '拒绝'}成功`)
    resetInteractionState()
  } catch (error) {
    const message = getErrorMessage(error, '审核操作失败，请稍后重试')
    actionErrorMessage.value = message
    toast.error(message)
  } finally {
    loadingAction.value = null
    acting.value = false
  }
}

watch(
  () => props.status,
  (status) => {
    if (!canReviewArticle(status)) {
      resetInteractionState()
    }
  },
)

onClickOutside(barRef, () => {
  if (loadingAction.value) return
  if (!approvePending.value && !activeReasonAction.value) return
  resetInteractionState()
})
</script>

<template>
  <div
    ref="barRef"
    class="flex flex-wrap items-center justify-end gap-3"
  >
    <Button
      type="button"
      pill
      :variant="approvePending ? 'success' : 'secondary'"
      :disabled="!canAct"
      :loading="loadingAction === REVIEW_ACTION.APPROVE"
      class="review-action-button"
      :class="{
        'review-action-button--processed': showProcessedState,
        'review-action-button--armed': approvePending,
        'review-action-button--success': approvePending,
      }"
      @click="handleApproveClick"
    >
      <Transition name="review-action-label" mode="out-in">
        <span
          :key="approvePending ? 'approve-confirm' : 'approve-default'"
          class="review-action-button__label"
        >
          {{ approvePending ? '确认通过' : '通过' }}
        </span>
      </Transition>
    </Button>

    <div
      v-for="option in REASON_ACTIONS"
      :key="option.value"
      :ref="(element) => setTriggerRef(option.value, element)"
      class="relative"
    >
      <Button
        type="button"
        pill
        :variant="activeReasonAction === option.value ? 'warning' : 'secondary'"
        :disabled="!canAct"
        class="review-action-button"
        :class="{
          'review-action-button--processed': showProcessedState,
          'review-action-button--armed': activeReasonAction === option.value,
          'review-action-button--warning': activeReasonAction === option.value,
        }"
        @click="openReasonPopover(option.value)"
      >
        <Transition name="review-action-label" mode="out-in">
          <span
            :key="`${option.value}-${activeReasonAction === option.value ? 'armed' : 'idle'}`"
            class="review-action-button__label"
          >
            {{ getReasonTriggerLabel(option.value) }}
          </span>
        </Transition>
      </Button>

      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-1 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-1 opacity-0"
      >
        <div
          v-if="activeReasonAction === option.value"
          class="absolute z-20 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_96%,transparent)] p-4 shadow-[var(--shadow-lg)] backdrop-blur-xl"
          :class="[
            popoverPlacement === 'top'
              ? 'bottom-[calc(100%+0.75rem)] right-0 origin-bottom-right'
              : 'top-[calc(100%+0.75rem)] right-0 origin-top-right',
          ]"
        >
          <div class="space-y-3">
            <p class="text-xs leading-5 text-[var(--color-text-muted)]">
              {{ getHelperText(option.value) }}
            </p>

            <div>
              <Textarea
                :model-value="reasonDrafts[option.value]"
                :maxlength="REVIEW_REASON_MAX_LENGTH"
                :rows="4"
                resize="auto"
                :disabled="loadingAction !== null"
                :invalid="Boolean(reasonErrors[option.value])"
                :placeholder="getPlaceholder(option.value)"
                @update:model-value="handleReasonInput(option.value, $event)"
              />
              <div class="mt-2 flex items-center justify-between gap-3">
                <p
                  class="text-xs text-[var(--color-danger)]"
                  :class="{ invisible: !reasonErrors[option.value] }"
                >
                  {{ reasonErrors[option.value] || '占位' }}
                </p>
                <p class="text-xs text-[var(--color-text-muted)]">
                  {{ reasonDrafts[option.value].length }}/{{ REVIEW_REASON_MAX_LENGTH }}
                </p>
              </div>
            </div>

            <p
              v-if="actionErrorMessage"
              class="text-xs leading-5 text-[var(--color-danger)]"
            >
              {{ actionErrorMessage }}
            </p>

            <div class="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                @click="closeReasonPopover"
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                pill
                variant="danger"
                class="review-action-confirm"
                :loading="loadingAction === option.value"
                :disabled="isReasonConfirmDisabled(option.value)"
                @click="submitAction(option.value)"
              >
                {{ getConfirmLabel(option.value) }}
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.review-action-button {
  width: var(--review-action-width, 6.5rem);
  overflow: hidden;
  transform-origin: center;
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    width 240ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms ease,
    filter 220ms ease,
    background-color 220ms ease,
    border-color 220ms ease,
    color 220ms ease;
  will-change: transform, width;
}

.review-action-button--armed {
  --review-action-width: 8.75rem;
  filter: saturate(1.04);
}

.review-action-button--success {
  background: var(--color-success);
  color: white;
  border-color: transparent;
  box-shadow: 0 14px 28px rgb(20 134 60 / 0.18);
}

.review-action-button--warning {
  background: var(--color-warning);
  color: white;
  border-color: transparent;
  box-shadow: 0 14px 28px rgb(185 107 0 / 0.18);
}

.review-action-button--processed {
  background: color-mix(in srgb, var(--color-text) 8%, var(--color-surface));
  color: var(--color-text-muted);
  border-color: color-mix(in srgb, var(--color-border) 86%, transparent);
  box-shadow: none;
  cursor: not-allowed;
  filter: grayscale(0.18);
}

.review-action-button__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.25rem;
  white-space: nowrap;
}

.review-action-confirm {
  background: var(--color-danger);
  color: white;
  border-color: transparent;
  box-shadow: 0 10px 22px rgb(217 44 32 / 0.18);
}

.review-action-confirm:disabled {
  opacity: 1;
  background: color-mix(in srgb, var(--color-danger) 12%, white);
  color: color-mix(in srgb, var(--color-danger) 76%, var(--color-text));
  border-color: color-mix(in srgb, var(--color-danger) 18%, transparent);
  box-shadow: none;
}

.review-action-label-enter-active,
.review-action-label-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 180ms ease;
}

.review-action-label-enter-from {
  opacity: 0;
  transform: translateY(7px) scale(0.94);
  filter: blur(4px);
}

.review-action-label-leave-to {
  opacity: 0;
  transform: translateY(-7px) scale(1.04);
  filter: blur(4px);
}

.review-action-label-enter-to,
.review-action-label-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
</style>
