<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import { uploadImageFile, validateImageFile, type ImageUploadResult } from '@/shared/image-upload'

const props = withDefaults(defineProps<{ url?: string; disabled?: boolean }>(), { url: '', disabled: false })
const emit = defineEmits<{ 'update:url': [string] }>()
const toast = useToast()
const input = ref<HTMLInputElement | null>(null)
const viewport = ref<HTMLButtonElement | null>(null)
const image = ref<HTMLImageElement | null>(null)
const draftUrl = ref('')
const sourceUrl = computed(() => draftUrl.value || props.url)
const dirty = ref(false)
const uploading = ref(false)
const ready = ref(false)
const loadFailed = ref(false)
const geometry = reactive({ width: 1, height: 160, naturalWidth: 1, naturalHeight: 1, x: 0, y: 0 })
const drag = ref<{ id: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)
const scale = computed(() => Math.max(geometry.width / geometry.naturalWidth, geometry.height / geometry.naturalHeight))
const overflowX = computed(() => Math.max(0, (geometry.naturalWidth * scale.value - geometry.width) / 2))
const overflowY = computed(() => Math.max(0, (geometry.naturalHeight * scale.value - geometry.height) / 2))
const imageStyle = computed(() => ({
  width: geometry.naturalWidth * scale.value + 'px',
  height: geometry.naturalHeight * scale.value + 'px',
  transform: 'translate(calc(-50% + ' + geometry.x * overflowX.value + 'px), calc(-50% + ' + geometry.y * overflowY.value + 'px))',
}))
const disabled = computed(() => props.disabled || uploading.value)
let observer: ResizeObserver | undefined
function measure() {
  if (!viewport.value) return
  geometry.width = viewport.value.clientWidth
  geometry.height = viewport.value.clientHeight
}
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  if (viewport.value) observer.observe(viewport.value)
})
function revokeDraft() {
  if (draftUrl.value) URL.revokeObjectURL(draftUrl.value)
  draftUrl.value = ''
}
onBeforeUnmount(() => { observer?.disconnect(); revokeDraft() })
watch(sourceUrl, () => { ready.value = false; loadFailed.value = false; drag.value = null }, { flush: 'sync' })
function pick() { if (!disabled.value && !sourceUrl.value) input.value?.click() }
function selectFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file || disabled.value) return
  const result = validateImageFile(file)
  if (!result.valid) { toast.error(result.message); return }
  revokeDraft()
  draftUrl.value = URL.createObjectURL(file)
  dirty.value = true
}
function loaded() {
  if (!image.value) return
  geometry.x = 0
  geometry.y = 0
  geometry.naturalWidth = image.value.naturalWidth
  geometry.naturalHeight = image.value.naturalHeight
  measure()
  ready.value = true
}
function remove() {
  if (disabled.value) return
  revokeDraft()
  dirty.value = false
  emit('update:url', '')
}
function startDrag(event: PointerEvent) {
  if (disabled.value || !ready.value || event.button !== 0) return
  drag.value = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: geometry.x, offsetY: geometry.y }
  viewport.value?.setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent) {
  const start = drag.value
  if (!start || start.id !== event.pointerId || disabled.value) return
  const x = overflowX.value ? Math.max(-1, Math.min(1, start.offsetX + (event.clientX - start.x) / overflowX.value)) : 0
  const y = overflowY.value ? Math.max(-1, Math.min(1, start.offsetY + (event.clientY - start.y) / overflowY.value)) : 0
  if (x !== geometry.x || y !== geometry.y) dirty.value = true
  geometry.x = x
  geometry.y = y
}
function endDrag(event: PointerEvent) {
  if (drag.value?.id !== event.pointerId) return
  drag.value = null
  if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId)
}
function keyMove(event: KeyboardEvent) {
  if (!sourceUrl.value || !ready.value || disabled.value) return
  const moves: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }
  const step = moves[event.key]
  if (!step) return
  event.preventDefault()
  if (overflowX.value) geometry.x = Math.max(-1, Math.min(1, geometry.x + step[0] / overflowX.value))
  if (overflowY.value) geometry.y = Math.max(-1, Math.min(1, geometry.y + step[1] / overflowY.value))
  dirty.value = true
}
async function prepareCover(): Promise<ImageUploadResult | null> {
  if (!dirty.value || !sourceUrl.value) return null
  if (!ready.value || !image.value) throw new Error('封面尚未加载完成，请稍后保存')
  if (uploading.value) throw new Error('封面正在上传，请稍候')
  uploading.value = true
  try {
    measure()
    const canvas = document.createElement('canvas')
    // Export exactly the visible selection; never stretch or expose blank edges.
    canvas.width = Math.max(1, Math.min(1600, Math.round(geometry.width / scale.value)))
    canvas.height = Math.max(1, Math.round(canvas.width * geometry.height / geometry.width))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器不支持封面裁剪')
    const sourceX = (overflowX.value - geometry.x * overflowX.value) / scale.value
    const sourceY = (overflowY.value - geometry.y * overflowY.value) / scale.value
    context.drawImage(image.value, sourceX, sourceY, geometry.width / scale.value, geometry.height / scale.value, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('封面裁剪失败')), 'image/webp', 0.92))
    const result = await uploadImageFile({ file: new File([blob], 'cover-crop.webp', { type: 'image/webp' }), bizType: 'COVER', oldUrl: props.url || undefined })
    emit('update:url', result.url)
    dirty.value = false
    // Keep the draft preview until the new persisted URL has reached the parent.
    return result
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') throw new Error('当前封面不允许裁剪，请移除后重新选择本地图片')
    throw error
  } finally { uploading.value = false }
}
defineExpose({ prepareCover })
</script>

<template>
  <div class="cover-crop">
    <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="disabled" @change="selectFile" />
    <div class="cover-crop__frame">
      <button ref="viewport" type="button" class="cover-crop__viewport" :class="{ 'cover-crop__viewport--image': sourceUrl, 'cover-crop__viewport--dragging': drag }" :disabled="disabled" :aria-label="sourceUrl ? '拖拽调整封面取景，也可使用方向键' : '上传封面'" :aria-busy="uploading" @click="pick" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="drag = null" @keydown="keyMove">
        <Transition name="cover-image" mode="out-in">
        <img v-if="sourceUrl" :class="{ 'cover-crop__image--ready': ready }" :key="sourceUrl" ref="image" :src="sourceUrl" crossorigin="anonymous" alt="封面取景预览" :draggable="false" :style="imageStyle" @load="loaded" @error="ready = false; loadFailed = true" />
        <span v-else key="empty" class="cover-crop__empty"><Icon name="image" :size="20" />点击上传封面</span>
        </Transition>
        <span v-if="loadFailed" class="cover-crop__loading" role="status">图片加载失败，请移除后重新选择。</span>
        <span v-if="uploading" class="cover-crop__loading" role="status">正在保存封面…</span>
      </button>
      <button v-if="sourceUrl" type="button" class="cover-crop__remove" :disabled="disabled" aria-label="移除封面" title="移除封面" @click.stop="remove"><Icon name="close" :size="16" /></button>
    </div>
    <p v-if="sourceUrl" class="cover-crop__hint">拖拽调整展示区域，点击底部保存确认。</p>
  </div>
</template>

<style scoped>
.cover-crop__frame { position: relative; height: 160px; }
.cover-crop__viewport { position: relative; display: block; width: 100%; height: 160px; padding: 0; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-elevated); color: var(--color-text-muted); cursor: pointer; }
.cover-crop__viewport--image { cursor: grab; touch-action: none; user-select: none; }
.cover-crop__viewport--dragging { cursor: grabbing; }
.cover-crop__viewport img { position: absolute; top: 50%; left: 50%; max-width: none; max-height: none; pointer-events: none; opacity: 0; transition: opacity 200ms ease; }
.cover-crop__viewport img.cover-crop__image--ready { opacity: 1; }
.cover-image-enter-active, .cover-image-leave-active { transition: opacity 200ms ease; }
.cover-image-enter-from, .cover-image-leave-to { opacity: 0 !important; }
@media (prefers-reduced-motion: reduce) {
  .cover-crop__viewport img, .cover-image-enter-active, .cover-image-leave-active { transition: none; }
}
.cover-crop__empty { display: flex; height: 100%; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.875rem; }
.cover-crop__remove { position: absolute; top: 0.5rem; right: 0.5rem; display: grid; width: 2rem; height: 2rem; place-items: center; border: 1px solid var(--color-border-strong); border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-text); cursor: pointer; }
.cover-crop__viewport:focus-visible, .cover-crop__remove:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.cover-crop__viewport:disabled, .cover-crop__remove:disabled { cursor: not-allowed; opacity: 0.6; }
.cover-crop__loading { position: absolute; inset: 0; display: grid; place-items: center; background: var(--color-surface-glass-strong); color: var(--color-text); }
.cover-crop__hint { margin-top: 0.5rem; color: var(--color-text-muted); font-size: 0.75rem; }
</style>
