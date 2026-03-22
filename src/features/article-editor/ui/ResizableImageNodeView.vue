<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

import {
  EDITOR_IMAGE_MAX_WIDTH_PERCENT,
  getEditorImageDisplayWidthPercent,
  normalizeEditorImageWidthPercent,
} from '@/features/article-editor/model/editor-image'

const props = defineProps(nodeViewProps)

const rootRef = ref<HTMLElement | null>(null)
const isResizing = ref(false)

type ResizeDirection = 'east' | 'west'

const widthPercent = computed(() => getEditorImageDisplayWidthPercent(props.node.attrs.widthPercent))
const canResize = computed(() => props.editor.isEditable && props.selected)
const imageAlt = computed(() =>
  typeof props.node.attrs.alt === 'string' && props.node.attrs.alt.trim() ? props.node.attrs.alt : '',
)
const imageTitle = computed(() =>
  typeof props.node.attrs.title === 'string' && props.node.attrs.title.trim() ? props.node.attrs.title : undefined,
)
const imageWidthStyle = computed(() => ({ width: `${widthPercent.value}%` }))

let dragState:
  | {
      direction: ResizeDirection
      startClientX: number
      startWidthPercent: number
      contentWidth: number
    }
  | null = null

function selectCurrentNode() {
  const position = typeof props.getPos === 'function' ? props.getPos() : null
  if (typeof position !== 'number') return

  props.editor.commands.setNodeSelection(position)
}

function resolveContentWidth(): number {
  const contentSurface = rootRef.value?.closest('.editor-content-surface')

  if (contentSurface instanceof HTMLElement && contentSurface.clientWidth > 0) {
    return contentSurface.clientWidth
  }

  return rootRef.value?.parentElement?.clientWidth ?? 0
}

function startResize(event: PointerEvent, direction: ResizeDirection) {
  if (!props.editor.isEditable) return

  const contentWidth = resolveContentWidth()
  if (contentWidth <= 0) return

  event.preventDefault()
  event.stopPropagation()
  selectCurrentNode()

  dragState = {
    direction,
    startClientX: event.clientX,
    startWidthPercent: widthPercent.value,
    contentWidth,
  }
  isResizing.value = true

  document.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerup', stopResize)
}

function handlePointerMove(event: PointerEvent) {
  if (!dragState) return

  event.preventDefault()

  const deltaX = event.clientX - dragState.startClientX
  const directionFactor = dragState.direction === 'east' ? 1 : -1
  const nextWidthPercent =
    dragState.startWidthPercent + (deltaX / dragState.contentWidth) * 100 * directionFactor
  const normalizedWidthPercent = normalizeEditorImageWidthPercent(nextWidthPercent)

  props.updateAttributes({
    widthPercent:
      normalizedWidthPercent === null ? EDITOR_IMAGE_MAX_WIDTH_PERCENT : normalizedWidthPercent,
  })
}

function stopResize() {
  if (!dragState) return

  const normalizedWidthPercent = normalizeEditorImageWidthPercent(props.node.attrs.widthPercent)
  props.updateAttributes({
    widthPercent: normalizedWidthPercent,
  })

  dragState = null
  isResizing.value = false

  document.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('pointerup', stopResize)
}

onBeforeUnmount(() => {
  stopResize()
})
</script>

<template>
  <NodeViewWrapper
    class="editor-resizable-image"
    :class="{
      'is-selected': selected,
      'is-resizing': isResizing,
      'is-readonly': !editor.isEditable,
    }"
    @click="selectCurrentNode"
  >
    <div ref="rootRef" class="editor-resizable-image__frame" :style="imageWidthStyle">
      <img
        :src="node.attrs.src"
        :alt="imageAlt"
        :title="imageTitle"
        draggable="false"
      />

      <template v-if="canResize">
        <button
          type="button"
          class="editor-resizable-image__handle editor-resizable-image__handle--nw"
          aria-label="调整图片宽度"
          @pointerdown="startResize($event, 'west')"
        />
        <button
          type="button"
          class="editor-resizable-image__handle editor-resizable-image__handle--ne"
          aria-label="调整图片宽度"
          @pointerdown="startResize($event, 'east')"
        />
        <button
          type="button"
          class="editor-resizable-image__handle editor-resizable-image__handle--sw"
          aria-label="调整图片宽度"
          @pointerdown="startResize($event, 'west')"
        />
        <button
          type="button"
          class="editor-resizable-image__handle editor-resizable-image__handle--se"
          aria-label="调整图片宽度"
          @pointerdown="startResize($event, 'east')"
        />
      </template>
    </div>
  </NodeViewWrapper>
</template>
