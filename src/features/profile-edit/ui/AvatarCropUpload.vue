<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'

import { Avatar, Button } from '@/shared/components/base'
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

function handleZoomInput(event: Event) {
  setZoom(Number((event.target as HTMLInputElement).value))
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
    toast.success('头像上传成功')
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
  <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-start">
    <div class="space-y-3">
      <input
        ref="inputRef"
        type="file"
        class="hidden"
        accept="image/jpeg,image/png,image/webp"
        :disabled="buttonDisabled"
        @change="handleInputChange"
      />

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

      <div v-if="hasDraft" class="space-y-3">
        <label class="block text-xs font-medium text-[var(--color-text-muted)]">
          缩放
          <input
            class="avatar-cropper__range mt-2"
            type="range"
            :min="MIN_ZOOM"
            :max="MAX_ZOOM"
            step="0.01"
            :value="crop.zoom"
            :disabled="buttonDisabled"
            @input="handleZoomInput"
          />
        </label>

        <div class="flex flex-wrap items-center gap-2">
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

    <div class="surface-2 flex flex-col items-center gap-3 rounded-[var(--radius-lg)] p-4 text-center">
      <p class="text-xs font-medium tracking-[0.08em] text-[var(--color-text-faint)]">
        头像取景
      </p>
      <p class="text-xs leading-5 text-[var(--color-text-muted)]">
        上传后拖拽图片调整位置，滚轮或滑杆缩放。点击“使用此头像”后再保存资料。
      </p>
    </div>
  </div>
</template>

<style scoped>
.avatar-cropper {
  position: relative;
  width: 11rem;
  height: 11rem;
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

.avatar-cropper__range {
  width: min(100%, 16rem);
  accent-color: var(--color-primary);
}
</style>
