<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'

import { Avatar, Button, ElasticSlider, Tooltip } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import {
  uploadImageFile,
  validateImageFile,
  type ImageUploadResult,
} from '@/shared/image-upload/model'

const CROP_SIZE = 512
const PREVIEW_SIZE = 176
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.1

const props = withDefaults(
  defineProps<{
    avatarUrl?: string | null
    nickname?: string
    disabled?: boolean
    oldUrl?: string
  }>(),
  {
    avatarUrl: null,
    nickname: '',
    disabled: false,
    oldUrl: undefined,
  },
)

const emit = defineEmits<{
  uploaded: [ImageUploadResult]
  error: [string]
}>()

const toast = useToast()
const inputRef = ref<HTMLInputElement | null>(null)
const cropImageRef = ref<HTMLImageElement | null>(null)
const draftUrl = ref('')
const draftFileName = ref('')
const uploading = ref(false)
const dragging = ref(false)
const dragStart = reactive({
  pointerId: 0,
  x: 0,
  y: 0,
  offsetX: 0,
  offsetY: 0,
})
const crop = reactive({
  naturalWidth: 0,
  naturalHeight: 0,
  baseScale: 1,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
})

const hasDraft = computed(() => Boolean(draftUrl.value))
const buttonDisabled = computed(() => props.disabled || uploading.value)
const avatarFallback = computed(() => props.nickname.trim().slice(0, 1).toUpperCase() || '?')
const imageStyle = computed(() => ({
  width: `${crop.naturalWidth * crop.baseScale * crop.zoom}px`,
  height: `${crop.naturalHeight * crop.baseScale * crop.zoom}px`,
  transform: `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px))`,
}))

function revokeDraftUrl() {
  if (draftUrl.value) {
    URL.revokeObjectURL(draftUrl.value)
  }
}

function clampOffset() {
  const scale = crop.baseScale * crop.zoom
  const maxX = Math.max(0, (crop.naturalWidth * scale - PREVIEW_SIZE) / 2)
  const maxY = Math.max(0, (crop.naturalHeight * scale - PREVIEW_SIZE) / 2)
  crop.offsetX = Math.min(maxX, Math.max(-maxX, crop.offsetX))
  crop.offsetY = Math.min(maxY, Math.max(-maxY, crop.offsetY))
}

function resetCropPosition() {
  crop.zoom = 1
  crop.offsetX = 0
  crop.offsetY = 0
}

function setZoom(value: number) {
  crop.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
  clampOffset()
}

function triggerPick() {
  if (buttonDisabled.value) return
  inputRef.value?.click()
}

async function handleInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''

  if (!file) return

  const validation = validateImageFile(file)
  if (!validation.valid) {
    emit('error', validation.message)
    toast.error(validation.message)
    return
  }

  revokeDraftUrl()
  draftUrl.value = URL.createObjectURL(file)
  draftFileName.value = file.name
  resetCropPosition()

  await nextTick()
  cropImageRef.value?.decode?.().catch(() => undefined)
}

function handleImageLoad(event: Event) {
  const image = event.target as HTMLImageElement
  crop.naturalWidth = image.naturalWidth || PREVIEW_SIZE
  crop.naturalHeight = image.naturalHeight || PREVIEW_SIZE
  crop.baseScale = Math.max(
    PREVIEW_SIZE / crop.naturalWidth,
    PREVIEW_SIZE / crop.naturalHeight,
  )
  resetCropPosition()
}

function handlePointerDown(event: PointerEvent) {
  if (!hasDraft.value || buttonDisabled.value) return

  dragging.value = true
  dragStart.pointerId = event.pointerId
  dragStart.x = event.clientX
  dragStart.y = event.clientY
  dragStart.offsetX = crop.offsetX
  dragStart.offsetY = crop.offsetY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== dragStart.pointerId) return

  crop.offsetX = dragStart.offsetX + event.clientX - dragStart.x
  crop.offsetY = dragStart.offsetY + event.clientY - dragStart.y
  clampOffset()
}

function handlePointerEnd(event: PointerEvent) {
  if (event.pointerId !== dragStart.pointerId) return
  dragging.value = false
}

function handleWheel(event: WheelEvent) {
  if (!hasDraft.value || buttonDisabled.value) return
  event.preventDefault()
  setZoom(crop.zoom + (event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))
}

function createCroppedFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const source = new Image()
    source.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = CROP_SIZE
      canvas.height = CROP_SIZE
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('浏览器不支持头像裁剪'))
        return
      }

      const scale = (crop.baseScale * crop.zoom * CROP_SIZE) / PREVIEW_SIZE
      const offsetScale = CROP_SIZE / PREVIEW_SIZE

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, CROP_SIZE, CROP_SIZE)
      context.translate(CROP_SIZE / 2 + crop.offsetX * offsetScale, CROP_SIZE / 2 + crop.offsetY * offsetScale)
      context.scale(scale, scale)
      context.drawImage(source, -source.naturalWidth / 2, -source.naturalHeight / 2)

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('头像裁剪失败'))
          return
        }

        const baseName = draftFileName.value.replace(/\.[^.]+$/, '') || 'avatar'
        resolve(new File([blob], `${baseName}-avatar.png`, { type: 'image/png' }))
      }, 'image/png')
    }
    source.onerror = () => reject(new Error('头像图片读取失败'))
    source.src = draftUrl.value
  })
}

async function uploadCroppedAvatar() {
  if (!hasDraft.value || buttonDisabled.value) return

  uploading.value = true

  try {
    const file = await createCroppedFile()
    const uploaded = await uploadImageFile({
      file,
      bizType: 'AVATAR',
      oldUrl: props.oldUrl,
    })

    emit('uploaded', uploaded)
    cancelDraft()
  } catch (error) {
    const message = error instanceof Error ? error.message : '头像上传失败'
    emit('error', message)
    toast.error(message)
  } finally {
    uploading.value = false
  }
}

function cancelDraft() {
  revokeDraftUrl()
  draftUrl.value = ''
  draftFileName.value = ''
  resetCropPosition()
}

onBeforeUnmount(() => {
  revokeDraftUrl()
})
</script>

<template>
  <div class="flex w-full flex-col items-center gap-4">
    <input
      ref="inputRef"
      type="file"
      class="hidden"
      accept="image/jpeg,image/png,image/webp"
      :disabled="buttonDisabled"
      @change="handleInputChange"
    />

    <div class="avatar-cropper-shell">
      <div
        class="avatar-cropper"
        :class="{ 'avatar-cropper--dragging': dragging }"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerEnd"
        @pointercancel="handlePointerEnd"
        @wheel="handleWheel"
      >
        <img
          v-if="draftUrl"
          ref="cropImageRef"
          :src="draftUrl"
          alt="头像裁剪预览"
          draggable="false"
          class="avatar-cropper__image"
          :style="imageStyle"
          @load="handleImageLoad"
        >
        <Avatar
          v-else
          :src="avatarUrl || undefined"
          :alt="nickname || 'avatar preview'"
          :name="nickname"
          :fallback="avatarFallback"
          size="xl"
          rounded
          class="size-44 bg-[color-mix(in_srgb,var(--color-surface-elevated)_88%,transparent)] text-4xl text-[var(--color-text)]"
        />
        <span class="avatar-cropper__ring" aria-hidden="true" />
      </div>

      <Tooltip
        class="avatar-cropper__help"
        text="上传后拖拽图片调整位置，滚轮或滑杆缩放；点击“使用此头像”后再保存资料。"
        placement="top"
        content-class="w-72 max-w-[min(18rem,calc(100vw-2rem))] whitespace-normal text-left leading-5"
        :open-delay="100"
      >
        <button
          type="button"
          class="avatar-cropper__help-trigger"
          aria-label="查看头像取景说明"
        >
          ?
        </button>
      </Tooltip>
    </div>

    <div v-if="hasDraft" class="flex w-full max-w-sm flex-col items-center gap-3">
      <ElasticSlider
        :default-value="crop.zoom"
        :starting-value="MIN_ZOOM"
        :max-value="MAX_ZOOM"
        :step-size="0.01"
        :is-stepped="true"
        :disabled="buttonDisabled"
        aria-label="头像缩放"
        class-name="mx-auto"
        @update:model-value="setZoom"
      />

      <div class="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" variant="primary" :loading="uploading" :disabled="buttonDisabled" @click="uploadCroppedAvatar">
          使用此头像
        </Button>
        <Button type="button" size="sm" variant="ghost" :disabled="buttonDisabled" @click="resetCropPosition">
          复位
        </Button>
        <Button type="button" size="sm" variant="ghost" :disabled="buttonDisabled" @click="cancelDraft">
          取消
        </Button>
      </div>
    </div>

    <Button
      v-else
      type="button"
      variant="secondary"
      :disabled="buttonDisabled"
      @click="triggerPick"
    >
      上传头像
    </Button>
  </div>
</template>

<style scoped>
.avatar-cropper-shell {
  position: relative;
  width: 11rem;
  height: 11rem;
}

.avatar-cropper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: color-mix(in srgb, var(--color-surface-elevated) 88%, transparent);
  box-shadow:
    0 18px 36px rgb(15 23 42 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.avatar-cropper__help {
  position: absolute;
  right: -0.2rem;
  bottom: -0.2rem;
  z-index: 5;
}

.avatar-cropper__help-trigger {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 84%, white 16%);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-surface-glass-strong) 96%, transparent);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  box-shadow: var(--shadow-xs);
  transition:
    color 160ms cubic-bezier(0.25, 1, 0.5, 1),
    border-color 160ms cubic-bezier(0.25, 1, 0.5, 1),
    transform 160ms cubic-bezier(0.25, 1, 0.5, 1);
}

.avatar-cropper__help-trigger:hover,
.avatar-cropper__help-trigger:focus-visible {
  border-color: color-mix(in srgb, var(--color-primary) 36%, var(--color-border-strong));
  color: var(--color-primary);
  transform: translateY(-1px);
  outline: none;
}

.avatar-cropper__help-trigger:focus-visible {
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.avatar-cropper--dragging {
  cursor: grabbing;
}

.avatar-cropper__image {
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: none;
  max-height: none;
  transform-origin: center;
  cursor: grab;
  pointer-events: none;
}

.avatar-cropper__ring {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 4px rgb(255 255 255 / 0.62),
    inset 0 0 0 1px rgb(15 23 42 / 0.08);
  pointer-events: none;
}

</style>
