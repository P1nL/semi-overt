<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { mapArticleDetailDtoToVm } from '@/entities/article'
import { ARTICLE_STATUS_BADGE_VARIANT_MAP, ARTICLE_STATUS_LABEL_MAP } from '@/entities/article'
import { cancelReviewByArticleId } from '@/features/article-cancel-review'
import {
  ArticleEditorForm,
  createEmptyEditorFormValues,
  mapArticleDetailVmToEditorFormValues,
  type EditorDraftSavedPayload,
  type EditorFormValues,
} from '@/features/article-editor'
import { submitArticleById } from '@/features/article-submit'
import { articleApi } from '@/shared/api/modules/article'
import { queryKeys } from '@/shared/api/queryKeys'
import { useToast } from '@/shared/composables/useToast'
import { Icon } from '@/shared/components/base'
import { ARTICLE_STATUS } from '@/shared/constants/article'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { STORAGE_KEY } from '@/shared/constants/storage'
import { queryClient } from '@/shared/lib/queryClient'
import { getErrorMessage } from '@/shared/utils/error'
import { localStore } from '@/shared/utils/storage'
import { calcWordCount, canCancelReview, canEditArticle, canSubmitArticle } from '@/shared/utils/article'
import { useEditorStore } from '@/stores/editor'

const route = useRoute()
const router = useRouter()
const editorStore = useEditorStore()
const toast = useToast()
const PUBLISH_COOLDOWN_MS = 30 * 60 * 1000
const MIN_SUBMIT_CONTENT_LENGTH = 50

const pageError = ref('')
function createInitialFormValues(): EditorFormValues {
  const routeArticleId = String(route.params.id || '')
  const article = editorStore.currentArticle

  if (routeArticleId && article && String(article.id) === routeArticleId) {
    const values = mapArticleDetailVmToEditorFormValues(article)

    if (editorStore.isSummaryIntentionallyEmpty(routeArticleId)) {
      return {
        ...values,
        summary: '',
      }
    }

    return values
  }

  return createEmptyEditorFormValues()
}

const formValues = ref<EditorFormValues>(createInitialFormValues())
const editorFormRef = ref<{
  saveDraft: (showToast?: boolean) => Promise<boolean>
} | null>(null)
const mainActionSlotRef = ref<HTMLDivElement | null>(null)
const publishActionRef = ref<HTMLDivElement | null>(null)
const cancelActionRef = ref<HTMLDivElement | null>(null)
const publishConfirming = ref(false)
const cancelConfirming = ref(false)
const publishCooldownRevealed = ref(false)
const saveFeedback = ref<'idle' | 'saved' | 'error'>('idle')
const submitError = ref('')
const nowTimestamp = ref(Date.now())
const publishCooldownUntil = ref(0)
const mainActionSlotWidth = ref<number | null>(null)

function getPublishCooldownStorageKey(id: string) {
  return `${STORAGE_KEY.ARTICLE_PUBLISH_COOLDOWN_PREFIX}${id}`
}

function readPersistedPublishCooldownUntil(id: string): number {
  if (!id || !localStore) return 0

  const stored = localStore.get<number>(getPublishCooldownStorageKey(id), 0)
  return typeof stored === 'number' && Number.isFinite(stored) ? stored : 0
}

function persistPublishCooldownUntil(id: string, until: number) {
  if (!id || !localStore) return

  if (until > Date.now()) {
    localStore.set<number>(getPublishCooldownStorageKey(id), until)
    return
  }

  localStore.remove(getPublishCooldownStorageKey(id))
}

let publishConfirmTimer: ReturnType<typeof setTimeout> | null = null
let cancelConfirmTimer: ReturnType<typeof setTimeout> | null = null
let publishCooldownRevealTimer: ReturnType<typeof setTimeout> | null = null
let saveFeedbackTimer: ReturnType<typeof setTimeout> | null = null
let publishCooldownTimer: ReturnType<typeof setInterval> | null = null

const articleId = computed(() => String(route.params.id || ''))
const hasRouteArticleId = computed(() => Boolean(articleId.value))
const currentArticle = computed(() => editorStore.currentArticle)
const currentRouteArticle = computed(() => {
  if (!hasRouteArticleId.value || !currentArticle.value) return null
  return String(currentArticle.value.id) === articleId.value ? currentArticle.value : null
})
const currentStatus = computed(() => currentRouteArticle.value?.status.value ?? '')
const currentStatusLabel = computed(() => currentRouteArticle.value?.status.label ?? '')
const isPending = computed(() => currentStatus.value === ARTICLE_STATUS.PENDING)
const isEditable = computed(() => !currentStatus.value || canEditArticle(currentStatus.value))
const isReadOnly = computed(() => Boolean(currentStatus.value) && !isEditable.value)
const contentWordCount = computed(() => calcWordCount(formValues.value.content))
const hasEnoughContentToSubmit = computed(() => contentWordCount.value >= MIN_SUBMIT_CONTENT_LENGTH)
const showSaveAction = computed(() => isEditable.value)
const showPublishAction = computed(
  () =>
    !isReadOnly.value &&
    hasEnoughContentToSubmit.value &&
    (!currentStatus.value || canSubmitArticle(currentStatus.value)),
)
const showCancelAction = computed(
  () => Boolean(currentRouteArticle.value) && canCancelReview(currentStatus.value),
)
function parseLocalDateTime(value?: string | null): number {
  if (!value) return 0

  const direct = new Date(value).getTime()
  if (!Number.isNaN(direct)) {
    return direct
  }

  const normalized = value.trim().replace(' ', 'T')
  const local = new Date(normalized).getTime()
  return Number.isNaN(local) ? 0 : local
}

function parseCooldownUntilFromErrorDetails(error: unknown): number {
  if (!error || typeof error !== 'object' || !('details' in error)) return 0

  const details = (error as { details?: unknown }).details
  if (!details || typeof details !== 'object') return 0

  const nextSubmitAt = 'nextSubmitAt' in details ? (details as { nextSubmitAt?: string | null }).nextSubmitAt : null
  const remainingSeconds = 'remainingSeconds' in details
    ? (details as { remainingSeconds?: number | string | null }).remainingSeconds
    : null

  const nextSubmitAtTimestamp = parseLocalDateTime(nextSubmitAt)
  if (nextSubmitAtTimestamp) {
    return nextSubmitAtTimestamp
  }

  const numericRemainingSeconds = typeof remainingSeconds === 'number'
    ? remainingSeconds
    : typeof remainingSeconds === 'string'
      ? Number(remainingSeconds)
      : 0

  if (!Number.isFinite(numericRemainingSeconds) || numericRemainingSeconds <= 0) {
    return 0
  }

  return Date.now() + numericRemainingSeconds * 1000
}

const lastSubmittedAtTimestamp = computed(() => {
  const raw = currentRouteArticle.value?.lastSubmittedAtRaw
  if (!raw) return 0

  const parsed = parseLocalDateTime(raw)
  if (!parsed) return 0

  // Guard against server/client clock skew or over-precise timestamps parsing slightly ahead.
  return Math.min(parsed, Date.now())
})
const publishCooldownRemainingMs = computed(() => {
  const localRemaining = Math.max(0, publishCooldownUntil.value - nowTimestamp.value)
  if (!showPublishAction.value) return localRemaining

  const baseTimestamp = lastSubmittedAtTimestamp.value
  const baseRemaining = baseTimestamp
    ? Math.max(0, baseTimestamp + PUBLISH_COOLDOWN_MS - nowTimestamp.value)
    : 0

  return Math.max(localRemaining, baseRemaining)
})
const isPublishCooldownActive = computed(() => publishCooldownRemainingMs.value > 0)
const publishCooldownText = computed(() => {
  if (!isPublishCooldownActive.value) return ''

  const remainingMinutes = Math.max(1, Math.ceil(publishCooldownRemainingMs.value / 60000))
  return `${remainingMinutes} 分钟后可发布`
})
const publishButtonDisabled = computed(
  () => editorStore.submitting,
)
const publishButtonTitle = computed(() => {
  if (isPublishCooldownActive.value && publishCooldownRevealed.value) {
    return `同一篇文章 30 分钟内只能发布一次，${publishCooldownText.value}`
  }

  return publishConfirming.value ? '再次点击确认发布' : '发布'
})
const publishButtonStateKey = computed(() => {
  if (isPublishCooldownActive.value && publishCooldownRevealed.value) return 'cooldown'
  if (publishConfirming.value) return 'confirm'
  return 'default'
})
const publishButtonLabel = computed(() => {
  if (isPublishCooldownActive.value && publishCooldownRevealed.value) {
    return publishCooldownText.value
  }

  return publishConfirming.value ? '确认发布' : '发布'
})
const mainActionSlotStyle = computed(() => {
  if (showPublishAction.value && publishButtonStateKey.value === 'cooldown') {
    return { width: 'var(--editor-publish-cooldown-width)' }
  }

  if (mainActionSlotWidth.value !== null) {
    return { width: `${mainActionSlotWidth.value}px` }
  }

  return undefined
})
const mainActionLabel = computed(() => {
  if (showCancelAction.value) {
    return cancelConfirming.value ? '确认取消' : '取消审核'
  }

  if (showPublishAction.value) {
    if (isPublishCooldownActive.value && publishCooldownRevealed.value) {
      return publishCooldownText.value
    }

    return publishConfirming.value ? '确认发布' : '发布'
  }

  return ''
})
const saveVisualState = computed<'saving' | 'saved' | 'error' | 'idle'>(() => {
  if (editorStore.saving) return 'saving'
  if (saveFeedback.value === 'saved') return 'saved'
  if (saveFeedback.value === 'error') return 'error'
  return 'idle'
})
const saveButtonTitle = computed(() => {
  if (editorStore.saving) return '保存中'
  if (saveFeedback.value === 'saved') return '保存成功'
  if (saveFeedback.value === 'error') return '保存失败'
  return '保存草稿'
})

const returnedReason = computed(() => {
  const article = currentRouteArticle.value
  if (!article) return ''
  if (article.status.value !== ARTICLE_STATUS.RETURNED) return ''
  return article.latestReviewReason || ''
})

const headerTitleModel = computed({
  get: () => formValues.value.title,
  set: (value: string) => {
    if (isReadOnly.value) return
    formValues.value = { ...formValues.value, title: value }
  },
})

const saveStatus = computed(() => {
  if (editorStore.submitting) {
    return { dotColor: 'var(--color-warning)', textColor: 'var(--color-text-faint)', text: '提交审核中' }
  }
  if (editorStore.saving) {
    return { dotColor: 'var(--color-warning)', textColor: 'var(--color-text-faint)', text: '保存中' }
  }
  if (pageError.value) {
    return { dotColor: 'var(--color-danger)', textColor: 'var(--color-danger)', text: '保存失败' }
  }
  if (isPending.value) {
    return { dotColor: 'var(--color-warning)', textColor: 'var(--color-warning)', text: '待审核中' }
  }
  if (editorStore.dirty) {
    return { dotColor: 'var(--color-text-faint)', textColor: 'var(--color-text-faint)', text: '有未保存修改' }
  }
  if (editorStore.lastSavedAt) {
    return { dotColor: 'var(--color-success)', textColor: 'var(--color-success)', text: formatSavedAt(editorStore.lastSavedAt) }
  }
  if (isReadOnly.value && currentStatusLabel.value) {
    return {
      dotColor: 'var(--color-text-faint)',
      textColor: 'var(--color-text-faint)',
      text: `${currentStatusLabel.value}（只读）`,
    }
  }
  return { dotColor: 'var(--color-text-faint)', textColor: 'var(--color-text-faint)', text: '尚未保存' }
})

function formatSavedAt(isoString: string): string {
  try {
    const saved = new Date(isoString)
    if (Number.isNaN(saved.getTime())) return isoString

    const now = new Date()
    const diffMin = (now.getTime() - saved.getTime()) / 60000
    const hh = String(saved.getHours()).padStart(2, '0')
    const mm = String(saved.getMinutes()).padStart(2, '0')
    const timeStr = `${hh}:${mm}`

    if (diffMin < 1) return '刚刚已保存'

    if (saved.toDateString() === now.toDateString()) {
      return `今天 ${timeStr} 已保存`
    }

    const month = String(saved.getMonth() + 1).padStart(2, '0')
    const day = String(saved.getDate()).padStart(2, '0')

    if (saved.getFullYear() === now.getFullYear()) {
      return `${month}-${day} ${timeStr} 已保存`
    }

    return `${saved.getFullYear()}-${month}-${day} ${timeStr} 已保存`
  } catch {
    return isoString
  }
}

let mainActionWidthFrame: number | null = null

function clearMainActionWidthFrame() {
  if (mainActionWidthFrame === null || typeof window === 'undefined') return
  window.cancelAnimationFrame(mainActionWidthFrame)
  mainActionWidthFrame = null
}

function syncMainActionSlotWidth() {
  const activeAction = showCancelAction.value ? cancelActionRef.value : publishActionRef.value
  if (!activeAction) return

  const measuredWidth = Math.ceil(activeAction.getBoundingClientRect().width) + 4
  if (measuredWidth > 0) {
    mainActionSlotWidth.value = measuredWidth
  }
}

async function syncMainActionSlotWidthAfterRender() {
  await nextTick()

  if (typeof window === 'undefined') {
    syncMainActionSlotWidth()
    return
  }

  clearMainActionWidthFrame()
  mainActionWidthFrame = window.requestAnimationFrame(() => {
    syncMainActionSlotWidth()
    mainActionWidthFrame = null
  })
}

function clearPublishConfirmTimer() {
  if (!publishConfirmTimer) return
  clearTimeout(publishConfirmTimer)
  publishConfirmTimer = null
}

function clearCancelConfirmTimer() {
  if (!cancelConfirmTimer) return
  clearTimeout(cancelConfirmTimer)
  cancelConfirmTimer = null
}

function clearPublishCooldownRevealTimer() {
  if (!publishCooldownRevealTimer) return
  clearTimeout(publishCooldownRevealTimer)
  publishCooldownRevealTimer = null
}

function clearSaveFeedbackTimer() {
  if (!saveFeedbackTimer) return
  clearTimeout(saveFeedbackTimer)
  saveFeedbackTimer = null
}

function clearPublishCooldownTimer() {
  if (!publishCooldownTimer) return
  clearInterval(publishCooldownTimer)
  publishCooldownTimer = null
}

function resetPublishConfirm() {
  publishConfirming.value = false
  clearPublishConfirmTimer()
}

function resetPublishCooldownReveal() {
  publishCooldownRevealed.value = false
  clearPublishCooldownRevealTimer()
}

function resetCancelConfirm() {
  cancelConfirming.value = false
  clearCancelConfirmTimer()
}

function armPublishConfirmTimeout() {
  clearPublishConfirmTimer()
  publishConfirmTimer = setTimeout(() => {
    publishConfirming.value = false
  }, 3000)
}

function armCancelConfirmTimeout() {
  clearCancelConfirmTimer()
  cancelConfirmTimer = setTimeout(() => {
    cancelConfirming.value = false
  }, 3000)
}

function armPublishCooldownRevealTimeout() {
  clearPublishCooldownRevealTimer()
  publishCooldownRevealTimer = setTimeout(() => {
    publishCooldownRevealed.value = false
  }, 3000)
}

function setSaveFeedback(state: 'idle' | 'saved' | 'error', duration = 0) {
  clearSaveFeedbackTimer()
  saveFeedback.value = state

  if (duration > 0) {
    saveFeedbackTimer = setTimeout(() => {
      saveFeedback.value = 'idle'
    }, duration)
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (!target) return

  if (publishConfirming.value && publishActionRef.value?.contains(target)) return
  if (publishCooldownRevealed.value && publishActionRef.value?.contains(target)) return
  if (cancelConfirming.value && cancelActionRef.value?.contains(target)) return

  if (publishConfirming.value) {
    resetPublishConfirm()
  }

  if (publishCooldownRevealed.value) {
    resetPublishCooldownReveal()
  }

  if (cancelConfirming.value) {
    resetCancelConfirm()
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  resetPublishConfirm()
  resetPublishCooldownReveal()
  resetCancelConfirm()
}

function syncPublishConfirmListeners(active: boolean) {
  if (active) {
    document.addEventListener('pointerdown', handleDocumentPointerDown as EventListener)
    document.addEventListener('keydown', handleDocumentKeydown as EventListener)
    return
  }

  document.removeEventListener('pointerdown', handleDocumentPointerDown as EventListener)
  document.removeEventListener('keydown', handleDocumentKeydown as EventListener)
}

function handlePublishAction() {
  if (!showPublishAction.value || publishButtonDisabled.value) return

  if (isPublishCooldownActive.value) {
    resetCancelConfirm()
    resetPublishConfirm()
    publishCooldownRevealed.value = true
    armPublishCooldownRevealTimeout()
    return
  }

  if (publishConfirming.value) {
    void submitArticle()
    return
  }

  resetCancelConfirm()
  publishConfirming.value = true
  armPublishConfirmTimeout()
}

function handleCancelAction() {
  if (!showCancelAction.value || editorStore.submitting) return

  if (cancelConfirming.value) {
    void cancelReview()
    return
  }

  resetPublishConfirm()
  cancelConfirming.value = true
  armCancelConfirmTimeout()
}

async function handleSaveDraft() {
  if (!showSaveAction.value || editorStore.saving || isReadOnly.value) return

  const saved = await editorFormRef.value?.saveDraft(true)
  setSaveFeedback(saved ? 'saved' : 'error', saved ? 900 : 1400)
}

function onDraftSaved(payload: EditorDraftSavedPayload) {
  pageError.value = ''
  submitError.value = ''
  editorStore.setLastSavedAt(payload.savedAt)
}

function onLoaded(values: EditorFormValues) {
  formValues.value = values
}

function onError(message: string) {
  pageError.value = message
  submitError.value = ''
}

function formatDateOnly(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return isoString

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

async function onCreated(id: number | string) {
  if (hasRouteArticleId.value) return
  await router.replace({ name: ROUTE_NAME.ARTICLE_EDITOR, params: { id: String(id) } })
}

async function submitArticle() {
  if (currentStatus.value && !canSubmitArticle(currentStatus.value)) return

  const saved = await editorFormRef.value?.saveDraft(false)
  if (!saved) {
    const message = pageError.value || '提交前请先完成保存'
    toast.error(message)
    return
  }

  const article = editorStore.currentArticle
  if (!article) {
    const message = '文章创建失败，请稍后重试'
    submitError.value = message
    toast.error(message)
    return
  }

  submitError.value = ''
  pageError.value = ''
  setSaveFeedback('saved', 900)
  editorStore.submitting = true

  try {
    const result = await submitArticleById(article.id)
    const submittedAt = parseLocalDateTime(result.lastSubmittedAt)
    const cooldownUntil = (submittedAt || Date.now()) + PUBLISH_COOLDOWN_MS
    const nextArticle = {
      ...article,
      status: {
        value: ARTICLE_STATUS.PENDING,
        label: ARTICLE_STATUS_LABEL_MAP.PENDING,
        variant: ARTICLE_STATUS_BADGE_VARIANT_MAP.PENDING,
      },
      latestReviewReason: null,
      submitCount: result.submitCount,
      submitCountText: `已提交 ${result.submitCount} 次`,
      lastSubmittedAt: formatDateOnly(result.lastSubmittedAt),
      lastSubmittedAtRaw: result.lastSubmittedAt,
    }

    publishCooldownUntil.value = cooldownUntil
    persistPublishCooldownUntil(String(article.id), cooldownUntil)

    editorStore.setCurrentArticle(nextArticle)
    queryClient.setQueryData(queryKeys.articleDetail(article.id), nextArticle)
    void queryClient.invalidateQueries({
      queryKey: queryKeys.articleDetail(article.id),
    })
    editorStore.dirty = false

    resetPublishConfirm()
    setSaveFeedback('idle')
    toast.success('文章已提交审核')
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reviewPendingRoot,
    })

  } catch (error) {
    const message = getErrorMessage(error, '提交失败，请稍后重试')
    if (
      /30\s*(分钟|鍒嗛挓)/.test(message)
    ) {
      const backendCooldownUntil = parseCooldownUntilFromErrorDetails(error)
      const persistedUntil = readPersistedPublishCooldownUntil(String(article.id))
      const candidates = [
        persistedUntil > Date.now() ? persistedUntil : 0,
        backendCooldownUntil > Date.now() ? backendCooldownUntil : 0,
      ].filter((value) => value > 0)
      const nextCooldownUntil = candidates.length
        ? Math.max(...candidates)
        : Date.now() + PUBLISH_COOLDOWN_MS

      publishCooldownUntil.value = nextCooldownUntil
      persistPublishCooldownUntil(String(article.id), nextCooldownUntil)
      resetPublishConfirm()
    }
    submitError.value = message
    toast.error(message)
  } finally {
    editorStore.submitting = false
  }
}

async function cancelReview() {
  const article = currentRouteArticle.value
  if (!article || !canCancelReview(currentStatus.value)) return

  editorStore.submitting = true

  try {
    await cancelReviewByArticleId(article.id)
    const detail = await articleApi.getArticleDetail(article.id)
    const nextArticle = mapArticleDetailDtoToVm(detail)
    editorStore.setCurrentArticle(nextArticle)
    queryClient.setQueryData(queryKeys.articleDetail(article.id), nextArticle)
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reviewPendingRoot,
    })

    await onCanceled()
    toast.success('已取消审核，文章恢复为草稿')
  } catch (error) {
    const message = getErrorMessage(error, '取消审核失败，请稍后重试')
    toast.error(message)
  } finally {
    editorStore.submitting = false
  }
}

async function onCanceled() {
  pageError.value = ''
  submitError.value = ''
  resetPublishConfirm()
  resetCancelConfirm()
  setSaveFeedback('idle')

  if (!articleId.value) return
  await editorStore.loadArticleDetail(articleId.value, true)
}

watch(publishConfirming, (value) => {
  syncPublishConfirmListeners(value || cancelConfirming.value || publishCooldownRevealed.value)

  if (!value) {
    clearPublishConfirmTimer()
  }
})

watch(cancelConfirming, (value) => {
  syncPublishConfirmListeners(value || publishConfirming.value || publishCooldownRevealed.value)

  if (!value) {
    clearCancelConfirmTimer()
  }
})

watch(publishCooldownRevealed, (value) => {
  syncPublishConfirmListeners(value || publishConfirming.value || cancelConfirming.value)

  if (!value) {
    clearPublishCooldownRevealTimer()
  }
})

watch(
  () => pageError.value,
  (value) => {
    if (value) {
      setSaveFeedback('error', 1400)
      return
    }

    if (saveFeedback.value === 'error') {
      setSaveFeedback('idle')
    }
  },
)

watch(
  () => [showCancelAction.value, showPublishAction.value, mainActionLabel.value] as const,
  ([showCancelActionValue, showPublishActionValue]) => {
    if (!showCancelActionValue && !showPublishActionValue) {
      mainActionSlotWidth.value = null
      clearMainActionWidthFrame()
      return
    }

    void syncMainActionSlotWidthAfterRender()
  },
  { immediate: true },
)

watch(isPending, (value) => {
  if (value) {
    resetPublishConfirm()
    resetCancelConfirm()
  }
})

watch(showCancelAction, (value) => {
  if (!value) {
    resetCancelConfirm()
  }
})

watch(hasEnoughContentToSubmit, (value) => {
  if (!value) {
    resetPublishConfirm()
  }
})

watch(
  hasRouteArticleId,
  (value) => {
    if (!value) {
      editorStore.resetEditorState()
      formValues.value = createEmptyEditorFormValues()
      nowTimestamp.value = Date.now()
      publishCooldownUntil.value = 0
    }
  },
  { immediate: true },
)

watch(articleId, () => {
  publishCooldownUntil.value = articleId.value
    ? readPersistedPublishCooldownUntil(articleId.value)
    : 0
}, { immediate: true })

watch(
  () => [showPublishAction.value, lastSubmittedAtTimestamp.value, publishCooldownUntil.value] as const,
  ([canShowPublish, submittedAt]) => {
    clearPublishCooldownTimer()

    const cooldownBase = submittedAt || publishCooldownUntil.value

    if (!canShowPublish || !cooldownBase) {
      return
    }

    nowTimestamp.value = Date.now()

    const cooldownEnd = submittedAt ? cooldownBase + PUBLISH_COOLDOWN_MS : cooldownBase

    if (cooldownEnd <= nowTimestamp.value) {
      return
    }

    publishCooldownTimer = setInterval(() => {
      nowTimestamp.value = Date.now()

      if (cooldownEnd <= nowTimestamp.value) {
        if (articleId.value) {
          persistPublishCooldownUntil(articleId.value, 0)
        }
        clearPublishCooldownTimer()
      }
    }, 1000)
  },
  { immediate: true },
)

watch(
  lastSubmittedAtTimestamp,
  (value) => {
    if (!articleId.value || !value) return
    persistPublishCooldownUntil(articleId.value, value + PUBLISH_COOLDOWN_MS)
  },
  { immediate: true },
)

watch(isPublishCooldownActive, (value) => {
  if (value) {
    resetPublishConfirm()
    return
  }

  resetPublishCooldownReveal()
})

onBeforeUnmount(() => {
  clearPublishConfirmTimer()
  clearCancelConfirmTimer()
  clearPublishCooldownRevealTimer()
  clearPublishCooldownTimer()
  clearSaveFeedbackTimer()
  clearMainActionWidthFrame()
  syncPublishConfirmListeners(false)
})
</script>

<template>
  <div class="editor-page">
    <header class="editor-topbar">
      <div class="editor-topbar__left">
        <div class="editor-topbar__logo">
          <Icon name="menu" :size="14" />
        </div>
        <div class="editor-topbar__divider" />
        <input
          v-model="headerTitleModel"
          class="editor-topbar__title"
          :disabled="isReadOnly"
          placeholder="未命名文章"
        />
      </div>

      <div class="editor-topbar__right">
        <span class="editor-save-pill" :style="{ color: saveStatus.textColor }">
          <span class="editor-save-pill__dot" :style="{ background: saveStatus.dotColor }" />
          <span>{{ saveStatus.text }}</span>
        </span>

        <Transition name="editor-save-slot">
          <div v-if="showSaveAction" class="editor-save-action-slot">
            <button
              type="button"
              class="editor-icon-btn"
              :class="{
                'is-saved': saveFeedback === 'saved',
                'is-error': saveFeedback === 'error',
              }"
              :disabled="editorStore.saving"
              :title="saveButtonTitle"
              @click="handleSaveDraft"
            >
              <Transition name="editor-save-icon" mode="out-in">
                <span :key="saveVisualState" class="editor-icon-btn__glyph">
                  <svg
                    v-if="saveVisualState === 'saving'"
                    class="spin"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  >
                    <path d="M8 2a6 6 0 0 1 6 6" opacity=".9" />
                    <path d="M14 8a6 6 0 0 1-6 6" opacity=".5" />
                    <path d="M8 14a6 6 0 0 1-6-6" opacity=".25" />
                  </svg>

                  <svg
                    v-else-if="saveVisualState === 'saved'"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                  </svg>

                  <svg
                    v-else-if="saveVisualState === 'error'"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M8 3 13 12H3L8 3Z" />
                    <path d="M8 6.2v2.8" />
                    <circle cx="8" cy="11.1" r="0.6" fill="currentColor" stroke="none" />
                  </svg>

                  <svg
                    v-else
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M13.5 14h-11a.5.5 0 0 1-.5-.5V2.5a.5.5 0 0 1 .5-.5H11l3 3v8.5a.5.5 0 0 1-.5.5z" />
                    <rect x="4.5" y="2" width="5.5" height="3.5" rx="0.3" />
                    <rect x="3" y="9.5" width="10" height="4" rx="0.3" />
                  </svg>
                </span>
              </Transition>
            </button>
          </div>
        </Transition>

        <Transition name="editor-main-action-slot">
          <div
            v-if="showCancelAction || showPublishAction"
            ref="mainActionSlotRef"
            class="editor-main-action-slot"
            :style="mainActionSlotStyle"
          >
            <Transition name="editor-main-action" mode="out-in" @after-enter="syncMainActionSlotWidth">
            <div
              v-if="showCancelAction"
              key="cancel"
              ref="cancelActionRef"
              class="editor-secondary-action"
            >
          <button
            type="button"
            class="editor-btn"
            :class="cancelConfirming ? 'editor-btn--confirm' : 'editor-btn--warning'"
            :disabled="editorStore.submitting"
            :title="cancelConfirming ? '再次点击确认取消' : '取消审核后文章会恢复为草稿'"
            @click="handleCancelAction"
          >
            <Transition name="editor-action-label" mode="out-in">
              <span :key="cancelConfirming ? 'confirm' : 'default'" class="editor-btn__label">
                {{ cancelConfirming ? '确认取消' : '取消审核' }}
              </span>
            </Transition>
          </button>
        </div>

            <div
              v-else-if="showPublishAction"
              key="publish"
              ref="publishActionRef"
              class="editor-primary-action"
            >
          <Transition name="editor-publish-button" mode="out-in" @after-enter="syncMainActionSlotWidth">
            <button
              :key="publishButtonStateKey"
              type="button"
              class="editor-btn"
              :class="[
                publishCooldownRevealed ? 'editor-btn--warning' : publishConfirming ? 'editor-btn--confirm' : 'editor-btn--primary',
                publishButtonStateKey === 'cooldown' ? 'editor-btn--cooldown-fixed' : '',
              ]"
              :disabled="publishButtonDisabled"
              :title="publishButtonTitle"
              @click="handlePublishAction"
            >
              {{ publishButtonLabel }}
            </button>
          </Transition>
          </div>
            </Transition>
          </div>
        </Transition>
      </div>
    </header>

    <main class="editor-page__body">
      <ArticleEditorForm
        ref="editorFormRef"
        v-model="formValues"
        :article-id="articleId || undefined"
        :disabled="isReadOnly"
        :load-on-mounted="hasRouteArticleId"
        :returned-reason="returnedReason"
        @created="onCreated"
        @draft-saved="onDraftSaved"
        @loaded="onLoaded"
        @error="onError"
      />
    </main>
  </div>
</template>

<style scoped>
.editor-page {
  --editor-topbar-height: 3.25rem;
  --editor-sticky-gap: 0.32rem;
  --editor-publish-cooldown-width: 8rem;
  display: flex;
  height: 100%;
  min-height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    var(--color-bg),
    color-mix(in srgb, var(--color-bg-elevated) 72%, var(--color-bg))
  );
  color: var(--color-text);
}

.editor-topbar {
  position: sticky;
  top: 0;
  z-index: 24;
  display: flex;
  flex-shrink: 0;
  min-height: var(--editor-topbar-height);
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 88%, white 4%);
  padding: 0 1.25rem;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.editor-topbar__left {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 0.85rem;
}

.editor-topbar__logo {
  display: inline-flex;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.6rem;
  background: color-mix(in srgb, var(--color-text) 90%, transparent);
  color: var(--color-surface);
  opacity: 0.9;
}

.editor-topbar__divider {
  width: 1px;
  height: 1rem;
  flex-shrink: 0;
  background: var(--color-border);
}

.editor-topbar__title {
  width: 100%;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  outline: none;
}

.editor-topbar__title::placeholder {
  color: var(--color-text-faint);
  font-weight: 400;
}

.editor-topbar__title:disabled {
  cursor: default;
  opacity: 0.72;
}

.editor-topbar__right {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
}

.editor-save-pill {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  padding: 0.3rem 0.65rem;
  font-size: 0.76rem;
  white-space: nowrap;
  transition:
    color 0.2s ease,
    opacity 0.2s ease;
}

.editor-save-pill__dot {
  width: 0.38rem;
  height: 0.38rem;
  flex-shrink: 0;
  border-radius: 999px;
  transition: background 0.2s ease;
}

.editor-save-action-slot {
  display: inline-flex;
  width: 2.125rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
}

.editor-save-slot-enter-active,
.editor-save-slot-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms ease;
}

.editor-save-slot-enter-from,
.editor-save-slot-leave-to {
  opacity: 0;
  transform: translateY(-3px) scale(0.94);
}

.editor-icon-btn {
  display: inline-flex;
  width: 2.125rem;
  height: 2.125rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.6rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-elevated) 60%, transparent);
  color: var(--color-text-faint);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.2s ease,
    transform 0.14s ease,
    opacity 0.18s ease;
}

.editor-icon-btn svg {
  width: 15px;
  height: 15px;
}

.editor-icon-btn__glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.editor-icon-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-surface-elevated) 90%, transparent);
  color: var(--color-text);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-xs);
}

.editor-icon-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.editor-icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.editor-icon-btn.is-saved {
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 50%, transparent);
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-success) 18%, transparent);
}

.editor-icon-btn.is-error {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 55%, transparent);
  background: color-mix(in srgb, var(--color-danger) 12%, var(--color-surface));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-danger) 16%, transparent);
}

.spin {
  animation: spin 0.9s linear infinite;
}

.editor-save-icon-enter-active,
.editor-save-icon-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms ease;
}

.editor-save-icon-enter-from,
.editor-save-icon-leave-to {
  opacity: 0;
  transform: scale(0.72);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.editor-secondary-action,
.editor-primary-action {
  display: inline-flex;
  width: auto;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
}

.editor-main-action-slot {
  display: inline-flex;
  width: auto;
  max-width: 100%;
  flex-shrink: 0;
  overflow: hidden;
  transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.editor-main-action-slot-enter-active,
.editor-main-action-slot-leave-active {
  transition:
    opacity 220ms ease,
    transform 240ms ease;
}

.editor-main-action-slot-enter-from,
.editor-main-action-slot-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}

.editor-btn {
  display: inline-flex;
  width: auto;
  min-width: 5.75rem;
  align-items: center;
  justify-content: center;
  height: 2.125rem;
  padding: 0 0.95rem;
  border-radius: 0.6rem;
  border: 1px solid transparent;
  font-size: 0.82rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.2s ease,
    transform 0.14s ease,
    opacity 0.18s ease;
}

.editor-btn__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.editor-btn:hover:not(:disabled) {
  box-shadow: var(--shadow-xs);
}

.editor-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.editor-btn:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.editor-btn--primary {
  background: var(--color-text);
  color: var(--color-surface);
}

.editor-btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-text) 92%, white 8%);
}

.editor-btn--confirm {
  border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
  background: color-mix(in srgb, var(--color-warning) 22%, var(--color-surface));
  color: var(--color-warning);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-warning) 14%, transparent);
}

.editor-btn--confirm:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-warning) 28%, var(--color-surface));
}

.editor-btn--warning {
  border-color: color-mix(in srgb, var(--color-warning) 38%, transparent);
  background: color-mix(in srgb, var(--color-warning) 18%, var(--color-surface));
  color: var(--color-warning);
}

.editor-btn--warning:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-warning) 24%, var(--color-surface));
}

.editor-btn--cooldown-fixed {
  width: var(--editor-publish-cooldown-width);
  min-width: var(--editor-publish-cooldown-width);
}

.editor-action-label-enter-active,
.editor-action-label-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms ease;
}

.editor-action-label-enter-from,
.editor-action-label-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.editor-main-action-enter-active,
.editor-main-action-leave-active {
  transition:
    opacity 240ms ease,
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.editor-main-action-enter-from,
.editor-main-action-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.96);
}

.editor-publish-button-enter-active,
.editor-publish-button-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms ease;
}

.editor-publish-button-enter-from,
.editor-publish-button-leave-to {
  opacity: 0;
  transform: translateY(-2px) scale(0.97);
}

.editor-page__body {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

@media (max-width: 960px) {
  .editor-topbar {
    flex-direction: column;
    align-items: stretch;
    padding: 0.75rem 0.9rem;
    gap: 0.65rem;
  }

  .editor-topbar__left {
    gap: 0.6rem;
  }

  .editor-topbar__logo,
  .editor-topbar__divider {
    display: none;
  }

  .editor-topbar__title {
    font-size: 1rem;
    line-height: 1.4;
  }

  .editor-topbar__right {
    width: 100%;
    flex-wrap: wrap;
    justify-content: stretch;
    gap: 0.5rem;
  }

  .editor-save-pill {
    display: none;
  }

  .editor-save-action-slot,
  .editor-main-action-slot,
  .editor-secondary-action,
  .editor-primary-action {
    flex: 1 1 auto;
    width: 100%;
  }

  .editor-btn,
  .editor-icon-btn {
    width: 100%;
  }

  .editor-icon-btn {
    height: 2.5rem;
    border-radius: 0.75rem;
  }

  .editor-btn {
    min-width: 0;
    min-height: 2.5rem;
    padding-inline: 1rem;
    border-radius: 0.75rem;
  }

  .editor-btn--cooldown-fixed {
    width: 100%;
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .editor-page {
    --editor-topbar-height: auto;
  }

  .editor-topbar {
    padding-inline: 0.75rem;
  }

  .editor-page__body {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
}
</style>
