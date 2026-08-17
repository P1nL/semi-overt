<script setup lang="ts">
import { Check, Copy, LoaderCircle } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { useToast } from '@/shared/composables/useToast'
import {
  applyContentLinkAttributes,
  getContentLinkHref,
  isPlainContentLink,
} from '@/shared/utils/contentLinks'

const props = withDefaults(
  defineProps<{
    root?: HTMLElement | null
    openOnClick?: boolean
  }>(),
  {
    root: null,
    openOnClick: false,
  },
)

const toast = useToast()
const previewRef = ref<HTMLElement | null>(null)
const activeLink = ref<HTMLAnchorElement | null>(null)
const previewHref = ref('')
const previewVisible = ref(false)
const previewPositioned = ref(false)
const previewIsPlainLink = ref(false)
const previewPosition = reactive({ top: 0, left: 0 })
type CopyState = 'idle' | 'copying' | 'copied'
const copyState = ref<CopyState>('idle')
const showHref = computed(() => !previewIsPlainLink.value)

let hideTimer: ReturnType<typeof setTimeout> | null = null
let copyResetTimer: ReturnType<typeof setTimeout> | null = null
let linkObserver: MutationObserver | null = null
let attachedRoot: HTMLElement | null = null

const MIN_COPY_FEEDBACK_MS = 420
const COPY_SUCCESS_MS = 1200

function clearHideTimer() {
  if (!hideTimer) return
  clearTimeout(hideTimer)
  hideTimer = null
}

function clearCopyResetTimer() {
  if (!copyResetTimer) return
  clearTimeout(copyResetTimer)
  copyResetTimer = null
}

function resetCopyState() {
  clearCopyResetTimer()
  copyState.value = 'idle'
}

function hide() {
  clearHideTimer()
  resetCopyState()
  previewVisible.value = false
  previewPositioned.value = false
  previewIsPlainLink.value = false
  previewHref.value = ''
  activeLink.value = null
}

function scheduleHide() {
  clearHideTimer()
  hideTimer = setTimeout(hide, 180)
}

function getLinkFromTarget(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null

  const link = target.closest('a[href]')
  if (!(link instanceof HTMLAnchorElement)) return null
  if (!attachedRoot?.contains(link)) return null

  return link
}

function enhanceLinks(root: HTMLElement | null) {
  if (!root) return

  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(applyContentLinkAttributes)
}

function clampCoordinate(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function positionPreview() {
  if (typeof window === 'undefined') return

  const link = activeLink.value
  const preview = previewRef.value
  if (!link || !preview || !link.isConnected) {
    hide()
    return
  }

  const linkRects = Array.from(link.getClientRects())
  const linkRect = linkRects[linkRects.length - 1] ?? link.getBoundingClientRect()
  const previewRect = preview.getBoundingClientRect()
  const viewportMargin = 12
  const previewGap = 8
  const maxLeft = window.innerWidth - previewRect.width - viewportMargin
  const maxTop = window.innerHeight - previewRect.height - viewportMargin

  let left = linkRect.right + previewGap
  let top = linkRect.top + (linkRect.height - previewRect.height) / 2

  if (left > maxLeft) {
    left = clampCoordinate(linkRect.left, viewportMargin, maxLeft)
    top = linkRect.bottom + previewGap

    if (top > maxTop) {
      top = linkRect.top - previewRect.height - previewGap
    }
  }

  previewPosition.left = Math.round(clampCoordinate(left, viewportMargin, maxLeft))
  previewPosition.top = Math.round(clampCoordinate(top, viewportMargin, maxTop))
  previewPositioned.value = true
}

function show(link: HTMLAnchorElement) {
  applyContentLinkAttributes(link)
  const href = getContentLinkHref(link)
  if (!href) return

  clearHideTimer()
  if (link !== activeLink.value || href !== previewHref.value) {
    resetCopyState()
  }

  activeLink.value = link
  previewHref.value = href
  previewIsPlainLink.value = isPlainContentLink(link, href)
  previewVisible.value = true
  previewPositioned.value = false

  void nextTick(() => {
    if (activeLink.value !== link) return
    positionPreview()
  })
}

function handleMouseOver(event: MouseEvent) {
  const link = getLinkFromTarget(event.target)
  if (!link) return

  if (link === activeLink.value && previewVisible.value) {
    clearHideTimer()
    return
  }

  show(link)
}

function handleMouseOut(event: MouseEvent) {
  const link = getLinkFromTarget(event.target)
  if (!link) return
  if (getLinkFromTarget(event.relatedTarget) === link) return

  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && previewRef.value?.contains(nextTarget)) {
    clearHideTimer()
    return
  }

  scheduleHide()
}

function handleFocusIn(event: FocusEvent) {
  const link = getLinkFromTarget(event.target)
  if (link) show(link)
}

function handleFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && previewRef.value?.contains(nextTarget)) return

  scheduleHide()
}

function handleClick(event: MouseEvent) {
  const link = getLinkFromTarget(event.target)
  if (!link) return

  applyContentLinkAttributes(link)
  if (!props.openOnClick || typeof window === 'undefined') return

  const href = getContentLinkHref(link)
  if (!href) return

  event.preventDefault()
  event.stopPropagation()
  const openedWindow = window.open(href, '_blank', 'noopener,noreferrer')
  if (openedWindow) openedWindow.opener = null
}

function handleViewportChange() {
  if (previewVisible.value) positionPreview()
}

function copyTextWithFallback(value: string) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  const copied = document.execCommand('copy')
  textarea.remove()

  if (!copied) {
    throw new Error('document.execCommand copy failed')
  }
}

async function copyHref() {
  const href = previewHref.value
  if (!href || typeof window === 'undefined' || copyState.value === 'copying') return

  clearHideTimer()
  clearCopyResetTimer()
  copyState.value = 'copying'
  const copyStartedAt = Date.now()

  try {
    let copied = false

    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(href)
        copied = true
      } catch {
        copied = false
      }
    }

    if (!copied) {
      copyTextWithFallback(href)
    }

    const feedbackDelay = MIN_COPY_FEEDBACK_MS - (Date.now() - copyStartedAt)
    if (feedbackDelay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, feedbackDelay))
    }

    if (!previewVisible.value || previewHref.value !== href) return

    copyState.value = 'copied'
    copyResetTimer = setTimeout(() => {
      if (previewHref.value === href) {
        copyState.value = 'idle'
      }
      copyResetTimer = null
    }, COPY_SUCCESS_MS)
  } catch {
    if (previewHref.value === href) {
      copyState.value = 'idle'
    }
    toast.error('复制失败，请手动复制链接')
  }
}

function detachRoot() {
  linkObserver?.disconnect()
  linkObserver = null

  if (!attachedRoot) return

  attachedRoot.removeEventListener('mouseover', handleMouseOver)
  attachedRoot.removeEventListener('mouseout', handleMouseOut)
  attachedRoot.removeEventListener('focusin', handleFocusIn)
  attachedRoot.removeEventListener('focusout', handleFocusOut)
  attachedRoot.removeEventListener('click', handleClick, true)
  attachedRoot = null
}

function attachRoot(root: HTMLElement | null) {
  detachRoot()
  hide()
  if (!root) return

  attachedRoot = root
  enhanceLinks(root)
  root.addEventListener('mouseover', handleMouseOver)
  root.addEventListener('mouseout', handleMouseOut)
  root.addEventListener('focusin', handleFocusIn)
  root.addEventListener('focusout', handleFocusOut)
  root.addEventListener('click', handleClick, true)

  linkObserver = new MutationObserver(() => enhanceLinks(root))
  linkObserver.observe(root, {
    childList: true,
    subtree: true,
  })
}

watch(() => props.root, attachRoot, { immediate: true })

onMounted(() => {
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})

onBeforeUnmount(() => {
  detachRoot()
  hide()
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})

defineExpose({ hide })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="previewVisible"
      ref="previewRef"
      class="content-link-preview"
      :class="{
        'is-positioned': previewPositioned,
        'is-copy-only': !showHref,
      }"
      :style="{
        top: `${previewPosition.top}px`,
        left: `${previewPosition.left}px`,
      }"
      role="group"
      :aria-label="showHref ? '链接地址预览' : '链接操作'"
      @mouseenter="clearHideTimer"
      @mouseleave="scheduleHide"
      @focusin="clearHideTimer"
      @focusout="scheduleHide"
    >
      <span v-if="showHref" class="content-link-preview__href">
        {{ previewHref }}
      </span>
      <button
        type="button"
        class="content-link-preview__copy"
        :class="{
          'is-copying': copyState === 'copying',
          'is-copied': copyState === 'copied',
        }"
        :aria-label="
          copyState === 'copying'
            ? '正在复制链接'
            : copyState === 'copied'
              ? '链接已复制'
              : '复制链接地址'
        "
        :aria-busy="copyState === 'copying'"
        :disabled="copyState === 'copying'"
        @click="copyHref"
      >
        <LoaderCircle
          v-if="copyState === 'copying'"
          class="content-link-preview__spinner"
          :size="14"
          :stroke-width="1.8"
        />
        <Check v-else-if="copyState === 'copied'" :size="15" :stroke-width="2" />
        <Copy v-else :size="14" :stroke-width="1.8" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.content-link-preview {
  position: fixed;
  z-index: 250;
  display: flex;
  max-width: min(32rem, calc(100vw - 1.5rem));
  min-height: 2.25rem;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 82%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-elevated) 94%, transparent);
  padding: 0.35rem 0.4rem 0.35rem 0.7rem;
  color: var(--color-text);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(14px);
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-2px);
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}

.content-link-preview.is-positioned {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.content-link-preview.is-copy-only {
  padding: 0.28rem;
  border-radius: var(--radius-pill);
}

.content-link-preview__href {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--color-text) 84%, var(--color-text-faint));
  font-family: var(--font-mono, "SFMono-Regular", Consolas, monospace);
  font-size: 0.76rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-link-preview__copy {
  display: inline-flex;
  width: 1.65rem;
  height: 1.65rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: calc(var(--radius-sm) + 1px);
  background: transparent;
  color: var(--color-text-faint);
  cursor: pointer;
  transition:
    background-color 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.is-copy-only .content-link-preview__copy {
  border-radius: var(--radius-pill);
}

.content-link-preview__copy:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

.content-link-preview__copy:active:not(:disabled) {
  transform: scale(0.94);
}

.content-link-preview__copy:disabled {
  cursor: default;
}

.content-link-preview__copy.is-copied {
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
  color: var(--color-success);
}

.content-link-preview__spinner {
  animation: content-link-preview-spin 640ms linear infinite;
}

@keyframes content-link-preview-spin {
  to {
    transform: rotate(360deg);
  }
}

.content-link-preview__copy:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
  outline-offset: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .content-link-preview__spinner {
    animation-duration: 1.2s;
  }
}
</style>
