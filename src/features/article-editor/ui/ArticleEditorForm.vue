<script setup lang="ts">
import Highlight from '@tiptap/extension-highlight'
import Heading from '@tiptap/extension-heading'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import TextAlign from '@tiptap/extension-text-align'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Text,
  Undo2,
  Link2,
} from 'lucide-vue-next'
import { TextSelection } from '@tiptap/pm/state'
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/vue-3'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { mapArticleDetailDtoToVm } from '@/entities/article/model/article.mapper'
import {
  buildEditorStats,
  createEmptyEditorFormValues,
  mapArticleDetailVmToEditorFormValues,
  mapEditorFormToDraftPayload,
  renderMarkdownToEditorHtml,
  serializeEditorToMarkdown,
  validateEditorForm,
  type EditorDraftSavedPayload,
  type EditorFormValues,
} from '@/features/article-editor/model'
import { ImageUploadButton, ImageUploadPreview, uploadImageFile } from '@/features/image-upload'
import { articleApi } from '@/shared/api/modules/article'
import { InlineMessage } from '@/shared/components/feedback'
import { useToast } from '@/shared/composables/useToast'
import {
  ARTICLE_IMAGE_ACCEPTED_EXTENSIONS,
  ARTICLE_SUMMARY_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
} from '@/shared/constants/article'
import { getErrorMessage } from '@/shared/utils/error'
import { useEditorStore } from '@/stores/editor'

import { ResizableImage } from './editor-resizable-image'

const props = withDefaults(
  defineProps<{
    articleId?: number | string
    modelValue?: EditorFormValues | null
    disabled?: boolean
    autoSaveDelay?: number
    loadOnMounted?: boolean
    returnedReason?: string
  }>(),
  {
    articleId: undefined,
    modelValue: null,
    disabled: false,
    autoSaveDelay: 2000,
    loadOnMounted: true,
    returnedReason: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [EditorFormValues]
  change: [EditorFormValues]
  'draft-saved': [EditorDraftSavedPayload]
  created: [number | string]
  loaded: [EditorFormValues]
  error: [string]
}>()

const editorStore = useEditorStore()
const toast = useToast()

const form = reactive<EditorFormValues>(createEmptyEditorFormValues())
const loading = ref(false)
const saveError = ref('')
const ready = ref(false)
const workingArticleId = ref<number | string | undefined>(props.articleId)
const sidePanelOpen = ref(true)
const titleTextareaRef = ref<HTMLTextAreaElement | null>(null)
const bodyImageInputRef = ref<HTMLInputElement | null>(null)
const formatToolbarRef = ref<HTMLElement | null>(null)
const bodyImageUploading = ref(false)
const syncingEditorContent = ref(false)
const headingMenuOpen = ref(false)
const headingMenuRef = ref<HTMLElement | null>(null)
const headingMenuTriggerRef = ref<HTMLButtonElement | null>(null)
const tableMenuOpen = ref(false)
const tableMenuRef = ref<HTMLElement | null>(null)
const tableMenuTriggerRef = ref<HTMLButtonElement | null>(null)
const toolbarSentinelRef = ref<HTMLElement | null>(null)

const errors = reactive<{
  title: string
  summary: string
  content: string
}>({
  title: '',
  summary: '',
  content: '',
})

let saveTimer: ReturnType<typeof setTimeout> | null = null
let toolbarObserver: IntersectionObserver | null = null
const MIN_SAVE_FEEDBACK_MS = 560

const disabledState = computed(() => props.disabled || loading.value || editorStore.submitting)
const titleCountText = computed(() => `${form.title.length}/${ARTICLE_TITLE_MAX_LENGTH}`)
const summaryCountText = computed(() => `${form.summary.length}/${ARTICLE_SUMMARY_MAX_LENGTH}`)
const readMinutesText = computed(() => `约 ${Math.max(1, Math.round(form.readMinutes || 0))} 分钟阅读`)
const bodyImageAccept = computed(() => ARTICLE_IMAGE_ACCEPTED_EXTENSIONS.join(','))
const PARAGRAPH_TAB_INDENT = '\u00A0\u00A0\u00A0\u00A0'
const headingOptions = [
  { level: 2, tag: 'H2' },
  { level: 3, tag: 'H3' },
  { level: 4, tag: 'H4' },
] as const
const headingLevels = headingOptions.map((option) => option.level) as ReadonlyArray<2 | 3 | 4>
type HeadingLevel = (typeof headingOptions)[number]['level']

const currentHeadingLevel = computed<HeadingLevel | null>(() => {
  const editor = contentEditor.value
  if (!editor) return null

  for (const level of headingLevels) {
    if (editor.isActive('heading', { level })) {
      return level
    }
  }

  return null
})

const currentHeadingOption = computed(() => {
  return headingOptions.find((option) => option.level === currentHeadingLevel.value) ?? headingOptions[0]
})

const contentEditor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
    }),
    Heading.configure({
      levels: [2, 3, 4],
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow',
        target: '_blank',
      },
    }),
    Highlight.configure({
      multicolor: false,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right'],
      defaultAlignment: 'left',
    }),
    ResizableImage.configure({
      inline: false,
      allowBase64: false,
    }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({
      placeholder: '开始写作，支持标题、列表、引用、代码块、分割线和图片。',
    }),
  ],
  content: renderMarkdownToEditorHtml(form.content),
  editable: !disabledState.value,
  editorProps: {
    attributes: {
      class: 'editor-content-surface',
    },
    handleKeyDown: (_view, event) => {
      if (
        event.key !== 'Tab' ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return false
      }

      const editor = contentEditor.value
      if (!editor || !editor.isActive('paragraph') || !editor.state.selection.empty) {
        return false
      }

      if (
        editor.isActive('bulletList') ||
        editor.isActive('orderedList') ||
        editor.isActive('blockquote') ||
        editor.isActive('codeBlock')
      ) {
        return false
      }

      event.preventDefault()
      return editor.chain().focus().insertContent(PARAGRAPH_TAB_INDENT).run()
    },
  },
  onUpdate: ({ editor }) => {
    if (syncingEditorContent.value) return

    const markdown = normalizeMarkdown(serializeEditorToMarkdown(editor))
    if (normalizeMarkdown(form.content) === markdown) return

    form.content = markdown
    syncContentStats()
    handleFormMutation()
  },
})

const titleModel = computed({
  get: () => form.title,
  set: (value: string) => {
    form.title = value
    syncContentStats()
    handleFormMutation()
  },
})

const summaryModel = computed({
  get: () => form.summary,
  set: (value: string) => {
    form.summary = value
    handleFormMutation()
  },
})

function normalizeMarkdown(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
}

function handleFormMutation() {
  if (!ready.value || disabledState.value) return

  editorStore.dirty = true
  emitFormChange()
  scheduleAutoSave()
}

function snapshotFormValues(): EditorFormValues {
  return {
    title: form.title,
    summary: form.summary,
    content: form.content,
    coverUrl: form.coverUrl,
    coverColor: form.coverColor,
    wordCount: form.wordCount,
    readMinutes: form.readMinutes,
    durationCategory: form.durationCategory,
  }
}

function patchFormValues(values: EditorFormValues) {
  form.title = values.title
  form.summary = values.summary
  form.content = values.content
  form.coverUrl = values.coverUrl
  form.coverColor = values.coverColor
  form.wordCount = values.wordCount
  form.readMinutes = values.readMinutes
  form.durationCategory = values.durationCategory
}

function hasFormDifferences(values: EditorFormValues): boolean {
  return (
    form.title !== values.title ||
    form.summary !== values.summary ||
    form.content !== values.content ||
    form.coverUrl !== values.coverUrl ||
    form.coverColor !== values.coverColor ||
    form.wordCount !== values.wordCount ||
    form.readMinutes !== values.readMinutes ||
    form.durationCategory !== values.durationCategory
  )
}

function clearSaveTimer() {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = null
}

function syncContentStats() {
  const stats = buildEditorStats(form.content, form.title)
  form.wordCount = stats.wordCount
  form.readMinutes = stats.readMinutes
  form.durationCategory = stats.durationCategory
}

async function resizeTitleTextarea() {
  if (!titleTextareaRef.value) return

  await nextTick()
  titleTextareaRef.value.style.height = 'auto'
  titleTextareaRef.value.style.height = `${titleTextareaRef.value.scrollHeight}px`
}

async function ensureArticleId(): Promise<{ articleId: number | string; created: boolean }> {
  if (workingArticleId.value !== undefined && workingArticleId.value !== null) {
    return {
      articleId: workingArticleId.value,
      created: false,
    }
  }

  const created = await articleApi.createArticle()
  workingArticleId.value = created.id

  return {
    articleId: created.id,
    created: true,
  }
}

function syncEditorFromMarkdown(markdown: string, force = false) {
  const editor = contentEditor.value
  if (!editor) return

  const nextMarkdown = normalizeMarkdown(markdown)
  const currentMarkdown = normalizeMarkdown(serializeEditorToMarkdown(editor))

  if (!force && currentMarkdown === nextMarkdown) {
    return
  }

  syncingEditorContent.value = true
  editor.commands.setContent(renderMarkdownToEditorHtml(markdown), {
    emitUpdate: false,
  })

  queueMicrotask(() => {
    syncingEditorContent.value = false
  })
}

function shouldPreserveEmptySummary(articleId?: number | string) {
  if (articleId === undefined || articleId === null) return false
  return editorStore.isSummaryIntentionallyEmpty(articleId)
}

function applySummaryGuard(values: EditorFormValues, articleId?: number | string): EditorFormValues {
  if (!shouldPreserveEmptySummary(articleId)) {
    return values
  }

  return {
    ...values,
    summary: '',
  }
}

async function loadArticleDetail() {
  if (workingArticleId.value === undefined || workingArticleId.value === null) return

  loading.value = true
  saveError.value = ''

  try {
    const detail = await articleApi.getArticleDetail(workingArticleId.value)
    const vm = mapArticleDetailDtoToVm(detail)
    editorStore.setCurrentArticle(vm)
    editorStore.setLastSavedAt(detail.updatedAt ?? '')

    const nextValues = applySummaryGuard(
      mapArticleDetailVmToEditorFormValues(vm),
      workingArticleId.value,
    )
    patchFormValues(nextValues)
    syncEditorFromMarkdown(nextValues.content, true)
    emitFormChange()
    emit('loaded', snapshotFormValues())
  } catch (error) {
    const message = getErrorMessage(error, '文章加载失败，请稍后重试')
    saveError.value = message
    emit('error', message)
  } finally {
    loading.value = false
  }
}

function syncValidationErrors() {
  const validation = validateEditorForm(snapshotFormValues())

  errors.title = validation.errors.title || ''
  errors.summary = validation.errors.summary || ''
  errors.content = validation.errors.content || ''

  return validation.valid
}

async function saveDraft(showToast = false): Promise<boolean> {
  saveError.value = ''

  if (disabledState.value || loading.value || editorStore.submitting) {
    clearSaveTimer()
    return false
  }

  if (!syncValidationErrors()) {
    return false
  }

  const { articleId, created } = await ensureArticleId()
  editorStore.setSummaryIntentionallyEmpty(articleId, form.summary.trim().length === 0)
  const saveStartedAt = Date.now()
  editorStore.saving = true

  try {
    const response = await articleApi.saveDraft(
      articleId,
      mapEditorFormToDraftPayload(snapshotFormValues()),
    )

    const localStats = buildEditorStats(form.content, form.title)
    form.wordCount = localStats.wordCount
    form.readMinutes = localStats.readMinutes
    form.durationCategory = localStats.durationCategory
    editorStore.dirty = false

    const payload: EditorDraftSavedPayload = {
      savedAt: response.savedAt,
      wordCount: localStats.wordCount,
      readMinutes: localStats.readMinutes,
      durationCategory: localStats.durationCategory,
      status: response.status,
    }

    emit('draft-saved', payload)

    if (
      !editorStore.currentArticle ||
      String(editorStore.currentArticle.id) !== String(articleId)
    ) {
      await editorStore.loadArticleDetail(articleId, true)
    }

    if (created) {
      emit('created', articleId)
    }

    if (showToast) {
      toast.success('草稿已保存')
    }

    return true
  } catch (error) {
    const message = getErrorMessage(error, '草稿保存失败，请稍后重试')
    saveError.value = message
    emit('error', message)

    if (showToast) {
      toast.error(message)
    }

    return false
  } finally {
    const elapsed = Date.now() - saveStartedAt
    const remaining = MIN_SAVE_FEEDBACK_MS - elapsed

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining))
    }

    editorStore.saving = false
  }
}

function scheduleAutoSave() {
  if (disabledState.value || editorStore.submitting) {
    clearSaveTimer()
    return
  }

  clearSaveTimer()
  saveTimer = setTimeout(() => {
    void saveDraft(false)
  }, props.autoSaveDelay)
}

function emitFormChange() {
  const values = snapshotFormValues()
  emit('update:modelValue', values)
  emit('change', values)
}

function runEditorCommand(command: (editor: TiptapEditor) => boolean) {
  const editor = contentEditor.value
  if (!editor || disabledState.value) return

  command(editor)
}

function toggleParagraph() {
  runEditorCommand((editor) => editor.chain().focus().setParagraph().run())
}

function setHeadingLevel(level: 2 | 3 | 4) {
  runEditorCommand((editor) => editor.chain().focus().toggleHeading({ level }).run())
}

function toggleHeadingMenu() {
  if (disabledState.value) return
  headingMenuOpen.value = !headingMenuOpen.value
  if (headingMenuOpen.value) tableMenuOpen.value = false
}

function closeHeadingMenu() {
  headingMenuOpen.value = false
}

function toggleTableMenu() {
  if (disabledState.value) return
  tableMenuOpen.value = !tableMenuOpen.value
  if (tableMenuOpen.value) headingMenuOpen.value = false
}

function closeTableMenu() {
  tableMenuOpen.value = false
}

function insertTablePreset(rows: number, cols: number, withHeaderRow: boolean) {
  runEditorCommand((editor) =>
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow }).run()
  )
  closeTableMenu()
}

function applyHeadingLevel(level: HeadingLevel) {
  setHeadingLevel(level)
  closeHeadingMenu()
}

function toggleHeadingBlock() {
  setHeadingLevel(2)
}

function toggleBold() {
  runEditorCommand((editor) => editor.chain().focus().toggleBold().run())
}

function toggleItalic() {
  runEditorCommand((editor) => editor.chain().focus().toggleItalic().run())
}

function toggleHighlight() {
  runEditorCommand((editor) => editor.chain().focus().toggleHighlight().run())
}

function setTextAlignment(alignment: 'left' | 'center' | 'right') {
  runEditorCommand((editor) => editor.chain().focus().setTextAlign(alignment).run())
}

function normalizeLinkHref(value: string): string {
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) {
    return value
  }

  return `https://${value}`
}

function finalizeLinkEditing(chain: ReturnType<TiptapEditor['chain']>, editor: TiptapEditor) {
  return chain.command(({ tr }) => {
    const linkMark = editor.schema.marks.link
    const linkEnd = tr.selection.to

    tr.setSelection(TextSelection.create(tr.doc, linkEnd))

    if (linkMark) {
      tr.removeStoredMark(linkMark)
    }

    return true
  })
}

function editLink() {
  const editor = contentEditor.value
  if (!editor || disabledState.value) return

  const hasSelection = !editor.state.selection.empty
  const isActiveLink = editor.isActive('link')

  if (!hasSelection && !isActiveLink) {
    toast.info('请先选中文字，再添加链接')
    return
  }

  if (typeof window === 'undefined') return

  const currentHref =
    typeof editor.getAttributes('link').href === 'string'
      ? editor.getAttributes('link').href
      : ''
  const input = window.prompt('输入链接地址，留空可移除链接', currentHref)

  if (input === null) return

  const href = input.trim()
  const chain = editor.chain().focus().extendMarkRange('link')

  if (!href) {
    finalizeLinkEditing(chain.unsetLink(), editor).run()
    return
  }

  finalizeLinkEditing(chain.setLink({ href: normalizeLinkHref(href) }), editor).run()
}

function toggleBulletList() {
  runEditorCommand((editor) => editor.chain().focus().toggleBulletList().run())
}

function toggleOrderedList() {
  runEditorCommand((editor) => editor.chain().focus().toggleOrderedList().run())
}

function insertQuote() {
  runEditorCommand((editor) => editor.chain().focus().toggleBlockquote().run())
}

function insertCodeBlock() {
  runEditorCommand((editor) => editor.chain().focus().toggleCodeBlock().run())
}

function insertDivider() {
  runEditorCommand((editor) => editor.chain().focus().setHorizontalRule().run())
}

function insertTable() {
  runEditorCommand((editor) =>
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  )
}

function undo() {
  runEditorCommand((editor) => editor.chain().focus().undo().run())
}

function redo() {
  runEditorCommand((editor) => editor.chain().focus().redo().run())
}

function canToggleBold() {
  return contentEditor.value?.can().chain().focus().toggleBold().run() ?? false
}

function canToggleItalic() {
  return contentEditor.value?.can().chain().focus().toggleItalic().run() ?? false
}

function canToggleHighlight() {
  return contentEditor.value?.can().chain().focus().toggleHighlight().run() ?? false
}

function canSetHeadingLevel(level: 2 | 3 | 4) {
  return contentEditor.value?.can().chain().focus().toggleHeading({ level }).run() ?? false
}

function canToggleBulletList() {
  return contentEditor.value?.can().chain().focus().toggleBulletList().run() ?? false
}

function canToggleOrderedList() {
  return contentEditor.value?.can().chain().focus().toggleOrderedList().run() ?? false
}

function canSetTextAlignment(alignment: 'left' | 'center' | 'right') {
  return contentEditor.value?.can().chain().focus().setTextAlign(alignment).run() ?? false
}

function canUndo() {
  return contentEditor.value?.can().chain().focus().undo().run() ?? false
}

function canRedo() {
  return contentEditor.value?.can().chain().focus().redo().run() ?? false
}

function isToolbarActive(name: string, attrs?: Record<string, unknown>) {
  return contentEditor.value?.isActive(name, attrs) ?? false
}

function isTextAlignmentActive(alignment: 'left' | 'center' | 'right') {
  const editor = contentEditor.value
  if (!editor) return alignment === 'left'

  if (alignment === 'left') {
    return !editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' })
  }

  return editor.isActive({ textAlign: alignment })
}

function toggleSidePanel() {
  sidePanelOpen.value = !sidePanelOpen.value
}

function triggerBodyImagePicker() {
  if (disabledState.value || bodyImageUploading.value) return
  bodyImageInputRef.value?.click()
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) return

  if (headingMenuOpen.value) {
    if (!headingMenuRef.value?.contains(target) && !headingMenuTriggerRef.value?.contains(target)) {
      closeHeadingMenu()
    }
  }

  if (tableMenuOpen.value) {
    if (!tableMenuRef.value?.contains(target) && !tableMenuTriggerRef.value?.contains(target)) {
      closeTableMenu()
    }
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  closeHeadingMenu()
  closeTableMenu()
}

async function handleBodyImageChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  bodyImageUploading.value = true

  try {
    const { articleId } = await ensureArticleId()
    const uploaded = await uploadImageFile({
      file,
      bizType: 'ARTICLE_IMAGE',
      articleId,
    })

    runEditorCommand((editor) =>
      editor
        .chain()
        .focus()
        .setImage({
          src: uploaded.url,
          alt: file.name,
        })
        .run(),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : '正文图片上传失败'
    emit('error', message)
    toast.error(message)
  } finally {
    bodyImageUploading.value = false
    target.value = ''
  }
}

watch(
  () => props.articleId,
  (value, previous) => {
    workingArticleId.value = value

    if (!ready.value || !props.loadOnMounted) return
    if (!value || String(value) === String(previous)) return
    if (previous === undefined || previous === null || previous === '') return

    void loadArticleDetail()
  },
)

watch(
  () => props.modelValue,
  (value) => {
    if (!value || !hasFormDifferences(value)) return

    patchFormValues(value)
    syncEditorFromMarkdown(value.content)
  },
  { deep: true },
)

watch(
  () => form.title,
  () => {
    void resizeTitleTextarea()
  },
  { immediate: true },
)

watch(
  disabledState,
  (value) => {
    contentEditor.value?.setEditable(!value)
    if (value) {
      clearSaveTimer()
      closeHeadingMenu()
    }
  },
  { immediate: true },
)

watch(
  () => editorStore.submitting,
  (value) => {
    if (value) {
      clearSaveTimer()
    }
  },
)

watch(
  contentEditor,
  (editor) => {
    if (!editor) return

    editor.setEditable(!disabledState.value)
    syncEditorFromMarkdown(form.content, true)
  },
  { immediate: true },
)

onMounted(async () => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)

  if (props.modelValue) {
    patchFormValues(props.modelValue)
  }

  syncContentStats()
  await resizeTitleTextarea()

  if (props.loadOnMounted) {
    await loadArticleDetail()
  } else {
    syncEditorFromMarkdown(form.content, true)
  }

  ready.value = true

  // 用哨兵元素检测工具栏是否吸顶：哨兵离开视口 = 工具栏已吸顶
  if (toolbarSentinelRef.value && formatToolbarRef.value) {
    const toolbar = formatToolbarRef.value
    toolbarObserver = new IntersectionObserver(
      ([entry]) => {
        // 哨兵不可见时，工具栏已吸顶，tooltip 应向下展示
        toolbar.classList.toggle('is-stuck', !entry.isIntersecting)
      },
      { threshold: [0] }
    )
    toolbarObserver.observe(toolbarSentinelRef.value)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  clearSaveTimer()
  toolbarObserver?.disconnect()
  toolbarObserver = null
  contentEditor.value?.destroy()
})

defineExpose({
  saveDraft,
})
</script>

<template>
  <div class="editor-workbench">
    <input
      ref="bodyImageInputRef"
      type="file"
      class="hidden"
      :accept="bodyImageAccept"
      :disabled="disabledState || bodyImageUploading"
      @change="handleBodyImageChange"
    />

    <div class="editor-main-shell" :class="{ 'editor-main-shell--side-collapsed': !sidePanelOpen }">
      <aside class="editor-left-rail">
        <div class="editor-insert-bar editor-insert-bar--rail">
          <button type="button" class="editor-insert-item" :disabled="disabledState" @click="toggleHeadingBlock">
            <span class="editor-insert-icon">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <line x1="3" y1="4" x2="3" y2="12" />
                <line x1="13" y1="4" x2="13" y2="12" />
                <line x1="3" y1="8" x2="13" y2="8" />
              </svg>
            </span>
            <span class="editor-insert-label">标题</span>
          </button>

          <button
            type="button"
            class="editor-insert-item"
            :disabled="disabledState || bodyImageUploading"
            @click="triggerBodyImagePicker"
          >
            <span class="editor-insert-icon">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="12" height="10" rx="2" />
                <circle cx="5.5" cy="6.5" r="1" />
                <path d="M2 10l3-3 2 2 2-2 3 3" />
              </svg>
            </span>
            <span class="editor-insert-label">{{ bodyImageUploading ? '上传中' : '图片<5MB' }}</span>
          </button>

          <button type="button" class="editor-insert-item" :disabled="disabledState" @click="insertCodeBlock">
            <span class="editor-insert-icon">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="5 4 1 8 5 12" />
                <polyline points="11 4 15 8 11 12" />
              </svg>
            </span>
            <span class="editor-insert-label">代码块</span>
          </button>

          <button type="button" class="editor-insert-item" :disabled="disabledState" @click="insertQuote">
            <span class="editor-insert-icon">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M3 5h3v3H3v1c0 1 .5 2 2 2M9 5h3v3H9v1c0 1 .5 2 2 2" />
              </svg>
            </span>
            <span class="editor-insert-label">引用</span>
          </button>

          <button type="button" class="editor-insert-item" :disabled="disabledState" @click="insertDivider">
            <span class="editor-insert-icon">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <line x1="2" y1="8" x2="14" y2="8" />
              </svg>
            </span>
            <span class="editor-insert-label">分割线</span>
          </button>
        </div>
      </aside>

      <div class="editor-content-region">
        <div class="editor-canvas-region">
          <aside class="editor-insert-bar editor-insert-bar--canvas">
            <button type="button" class="editor-insert-item" :disabled="disabledState" @click="toggleHeadingBlock">
              <span class="editor-insert-icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <line x1="3" y1="4" x2="3" y2="12" />
                  <line x1="13" y1="4" x2="13" y2="12" />
                  <line x1="3" y1="8" x2="13" y2="8" />
                </svg>
              </span>
              <span class="editor-insert-label">标题</span>
            </button>

            <button
              type="button"
              class="editor-insert-item"
              :disabled="disabledState || bodyImageUploading"
              @click="triggerBodyImagePicker"
            >
              <span class="editor-insert-icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="12" height="10" rx="2" />
                  <circle cx="5.5" cy="6.5" r="1" />
                  <path d="M2 10l3-3 2 2 2-2 3 3" />
                </svg>
              </span>
              <span class="editor-insert-label">{{ bodyImageUploading ? '上传中' : '图片<5MB' }}</span>
            </button>

            <button type="button" class="editor-insert-item" :disabled="disabledState" @click="insertCodeBlock">
              <span class="editor-insert-icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="5 4 1 8 5 12" />
                  <polyline points="11 4 15 8 11 12" />
                </svg>
              </span>
              <span class="editor-insert-label">代码块</span>
            </button>

            <button type="button" class="editor-insert-item" :disabled="disabledState" @click="insertQuote">
              <span class="editor-insert-icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <path d="M3 5h3v3H3v1c0 1 .5 2 2 2M9 5h3v3H9v1c0 1 .5 2 2 2" />
                </svg>
              </span>
              <span class="editor-insert-label">引用</span>
            </button>

            <button type="button" class="editor-insert-item" :disabled="disabledState" @click="insertDivider">
              <span class="editor-insert-icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <line x1="2" y1="8" x2="14" y2="8" />
                </svg>
              </span>
              <span class="editor-insert-label">分割线</span>
            </button>
          </aside>

          <section class="editor-canvas-shell">
            <InlineMessage v-if="saveError" tone="error" :message="saveError" class="mb-5" />

            <div v-if="returnedReason" class="editor-returned-banner">
              <svg class="editor-returned-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 2L14 13H2L8 2z" />
                <line x1="8" y1="7" x2="8" y2="10" />
                <circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none" />
              </svg>
              <div>
                <p class="editor-returned-label">退回原因</p>
                <p class="editor-returned-text">{{ returnedReason }}</p>
              </div>
            </div>

            <div class="editor-canvas">
              <textarea
                ref="titleTextareaRef"
                v-model="titleModel"
                class="editor-title-textarea"
                rows="1"
                :disabled="disabledState"
                :maxlength="ARTICLE_TITLE_MAX_LENGTH"
                placeholder="文章标题"
              />

              <p v-if="errors.title" class="editor-field-error">
                {{ errors.title }}
              </p>

              <p class="editor-title-count">{{ titleCountText }}</p>

              <div class="editor-canvas-separator" />

              <!-- 哨兵：工具栏上方 1px，离开视口即表示工具栏已吸顶 -->
              <div ref="toolbarSentinelRef" class="editor-toolbar-sentinel" aria-hidden="true" />

              <div ref="formatToolbarRef" class="editor-format-toolbar editor-format-toolbar--icons">
                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="正文"
                  :class="{ 'editor-tool-button--active': isToolbarActive('paragraph') }"
                  :disabled="disabledState"
                  aria-label="正文"
                  @click="toggleParagraph"
                >
                  <Text :size="16" :stroke-width="1.75" />
                </button>

                <div class="editor-heading-dropdown">
                <button
                  type="button"
                  class="editor-tool-button editor-tool-button--heading"
                  data-tooltip="标题"
                  :class="{ 'editor-tool-button--active': currentHeadingLevel !== null }"
                  :disabled="disabledState"
                  aria-label="标题"
                  ref="headingMenuTriggerRef"
                  :aria-expanded="headingMenuOpen"
                  aria-haspopup="menu"
                  @click="toggleHeadingMenu"
                >
                  <span class="editor-heading-trigger__badge">{{ currentHeadingOption.tag }}</span>
                  <ChevronDown class="editor-tool-button-caret" :size="12" :stroke-width="1.8" />
                </button>

                <Transition name="editor-toolbar-dropdown-menu">
                  <div
                    v-if="headingMenuOpen"
                    ref="headingMenuRef"
                    class="editor-toolbar-dropdown-menu"
                    role="menu"
                    aria-label="标题级别"
                  >
                    <button
                      v-for="level in headingLevels"
                      :key="level"
                      type="button"
                      class="editor-toolbar-dropdown-item"
                      :class="{ 'editor-toolbar-dropdown-item--active': currentHeadingLevel === level }"
                      :disabled="disabledState || !canSetHeadingLevel(level)"
                      role="menuitemradio"
                      :aria-checked="currentHeadingLevel === level"
                      @click="applyHeadingLevel(level)"
                    >
                      <span class="editor-toolbar-dropdown-item__badge">H{{ level }}</span>
                    </button>
                  </div>
                </Transition>
                </div>

                <!-- 表格下拉 -->
                <div class="editor-heading-dropdown">
                  <button
                    ref="tableMenuTriggerRef"
                    type="button"
                    class="editor-tool-button editor-tool-button--heading"
                    data-tooltip="表格"
                    :class="{ 'editor-tool-button--active': isToolbarActive('table') }"
                    :disabled="disabledState"
                    aria-label="插入表格"
                    :aria-expanded="tableMenuOpen"
                    aria-haspopup="menu"
                    @click="toggleTableMenu"
                  >
                    <span class="editor-heading-trigger__badge editor-table-trigger__badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <line x1="3" y1="8" x2="21" y2="8" />
                        <line x1="8" y1="8" x2="8" y2="21" />
                      </svg>
                    </span>
                    <ChevronDown class="editor-tool-button-caret" :size="12" :stroke-width="1.8" />
                  </button>

                  <Transition name="editor-toolbar-dropdown-menu">
                    <div
                      v-if="tableMenuOpen"
                      ref="tableMenuRef"
                      class="editor-toolbar-dropdown-menu editor-table-dropdown-menu"
                      role="menu"
                      aria-label="插入表格"
                    >
                      <button type="button" class="editor-toolbar-dropdown-item editor-table-dropdown-item" :disabled="disabledState" role="menuitem" @click="insertTablePreset(3, 3, true)">
                        <span class="editor-table-dropdown-item__icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="3" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="3" y1="15" x2="21" y2="15" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                            <line x1="15" y1="3" x2="15" y2="21" />
                          </svg>
                        </span>
                        <span>3×3 含表头</span>
                      </button>
                      <button type="button" class="editor-toolbar-dropdown-item editor-table-dropdown-item" :disabled="disabledState" role="menuitem" @click="insertTablePreset(4, 4, true)">
                        <span class="editor-table-dropdown-item__icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="7.5" x2="21" y2="7.5"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16.5" x2="21" y2="16.5"/><line x1="7.5" y1="3" x2="7.5" y2="21"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="16.5" y1="3" x2="16.5" y2="21"/></svg>
                        </span>
                        <span>4×4 含表头</span>
                      </button>
                      <button type="button" class="editor-toolbar-dropdown-item editor-table-dropdown-item" :disabled="disabledState" role="menuitem" @click="insertTablePreset(3, 2, true)">
                        <span class="editor-table-dropdown-item__icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="9" x2="12" y2="21"/></svg>
                        </span>
                        <span>2 列对比表</span>
                      </button>
                      <button type="button" class="editor-toolbar-dropdown-item editor-table-dropdown-item" :disabled="disabledState" role="menuitem" @click="insertTablePreset(4, 3, false)">
                        <span class="editor-table-dropdown-item__icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="7.5" y1="3" x2="7.5" y2="21"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="16.5" y1="3" x2="16.5" y2="21"/></svg>
                        </span>
                        <span>4×3 无表头</span>
                      </button>
                      <button type="button" class="editor-toolbar-dropdown-item editor-table-dropdown-item" :disabled="disabledState" role="menuitem" @click="insertTablePreset(2, 5, true)">
                        <span class="editor-table-dropdown-item__icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="6.6" y1="8" x2="6.6" y2="21"/><line x1="10.2" y1="8" x2="10.2" y2="21"/><line x1="13.8" y1="8" x2="13.8" y2="21"/><line x1="17.4" y1="8" x2="17.4" y2="21"/></svg>
                        </span>
                        <span>5 列宽表</span>
                      </button>
                    </div>
                  </Transition>
                </div>

                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="加粗"
                  :class="{ 'editor-tool-button--active': isToolbarActive('bold') }"
                  :disabled="disabledState || !canToggleBold()"
                  aria-label="加粗"
                  @click="toggleBold"
                >
                  <Bold :size="16" :stroke-width="1.75" />
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="斜体"
                  :class="{ 'editor-tool-button--active': isToolbarActive('italic') }"
                  :disabled="disabledState || !canToggleItalic()"
                  aria-label="斜体"
                  @click="toggleItalic"
                >
                  <Italic :size="16" :stroke-width="1.75" />
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="高亮"
                  :class="{ 'editor-tool-button--active': isToolbarActive('highlight') }"
                  :disabled="disabledState || !canToggleHighlight()"
                  aria-label="高亮"
                  @click="toggleHighlight"
                >
                  <Highlighter :size="16" :stroke-width="1.75" />
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="链接"
                  :class="{ 'editor-tool-button--active': isToolbarActive('link') }"
                  :disabled="disabledState"
                  aria-label="链接"
                  @click="editLink"
                >
                  <Link2 :size="16" :stroke-width="1.75" />
                </button>

                <div class="editor-format-divider" />

                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="左对齐"
                  :class="{ 'editor-tool-button--active': isTextAlignmentActive('left') }"
                  :disabled="disabledState || !canSetTextAlignment('left')"
                  aria-label="左对齐"
                  @click="setTextAlignment('left')"
                >
                  <AlignLeft :size="16" :stroke-width="1.75" />
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="居中"
                  :class="{ 'editor-tool-button--active': isTextAlignmentActive('center') }"
                  :disabled="disabledState || !canSetTextAlignment('center')"
                  aria-label="居中"
                  @click="setTextAlignment('center')"
                >
                  <AlignCenter :size="16" :stroke-width="1.75" />
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="右对齐"
                  :class="{ 'editor-tool-button--active': isTextAlignmentActive('right') }"
                  :disabled="disabledState || !canSetTextAlignment('right')"
                  aria-label="右对齐"
                  @click="setTextAlignment('right')"
                >
                  <AlignRight :size="16" :stroke-width="1.75" />
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="无序列表"
                  :class="{ 'editor-tool-button--active': isToolbarActive('bulletList') }"
                  :disabled="disabledState || !canToggleBulletList()"
                  aria-label="无序列表"
                  @click="toggleBulletList"
                >
                  <List :size="16" :stroke-width="1.75" />
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  data-tooltip="有序列表"
                  :class="{ 'editor-tool-button--active': isToolbarActive('orderedList') }"
                  :disabled="disabledState || !canToggleOrderedList()"
                  aria-label="有序列表"
                  @click="toggleOrderedList"
                >
                  <ListOrdered :size="16" :stroke-width="1.75" />
                </button>

                <div class="editor-format-divider" />

                <button
                  type="button"
                  class="editor-tool-button editor-tool-button--ghost"
                  data-tooltip="撤销"
                  :disabled="disabledState || !canUndo()"
                  aria-label="撤销"
                  @click="undo"
                >
                  <Undo2 :size="16" :stroke-width="1.75" />
                </button>

                <button
                  type="button"
                  class="editor-tool-button editor-tool-button--ghost"
                  data-tooltip="重做"
                  :disabled="disabledState || !canRedo()"
                  aria-label="重做"
                  @click="redo"
                >
                  <Redo2 :size="16" :stroke-width="1.75" />
                </button>
              </div>

              <div class="editor-format-toolbar">
                <button
                  type="button"
                  class="editor-tool-button"
                  :class="{ 'editor-tool-button--active': isToolbarActive('paragraph') }"
                  :disabled="disabledState"
                  @click="toggleParagraph"
                >
                  正文
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  :class="{ 'editor-tool-button--active': isToolbarActive('heading', { level: 2 }) }"
                  :disabled="disabledState"
                  @click="toggleHeadingBlock"
                >
                  标题
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  :class="{ 'editor-tool-button--active': isToolbarActive('bold') }"
                  :disabled="disabledState || !canToggleBold()"
                  @click="toggleBold"
                >
                  加粗
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  :class="{ 'editor-tool-button--active': isToolbarActive('italic') }"
                  :disabled="disabledState || !canToggleItalic()"
                  @click="toggleItalic"
                >
                  斜体
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  :class="{ 'editor-tool-button--active': isToolbarActive('bulletList') }"
                  :disabled="disabledState || !canToggleBulletList()"
                  @click="toggleBulletList"
                >
                  无序列表
                </button>

                <button
                  type="button"
                  class="editor-tool-button"
                  :class="{ 'editor-tool-button--active': isToolbarActive('orderedList') }"
                  :disabled="disabledState || !canToggleOrderedList()"
                  @click="toggleOrderedList"
                >
                  有序列表
                </button>

                <div class="editor-format-divider" />

                <button
                  type="button"
                  class="editor-tool-button editor-tool-button--ghost"
                  :disabled="disabledState || !canUndo()"
                  @click="undo"
                >
                  撤销
                </button>

                <button
                  type="button"
                  class="editor-tool-button editor-tool-button--ghost"
                  :disabled="disabledState || !canRedo()"
                  @click="redo"
                >
                  重做
                </button>
              </div>

              <div class="editor-content-editor-shell" :class="{ 'is-disabled': disabledState }">
                <EditorContent v-if="contentEditor" :editor="contentEditor" class="editor-content-editor" />
              </div>

              <p v-if="errors.content" class="editor-field-error">
                {{ errors.content }}
              </p>

              <div class="editor-wordcount">
                <span>{{ form.wordCount }} 字</span>
                <span>{{ readMinutesText }}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="editor-side-toggle-anchor" :class="{ 'editor-side-toggle-anchor--collapsed': !sidePanelOpen }">
        <button
          type="button"
          class="editor-side-toggle"
          :aria-label="sidePanelOpen ? '收起侧栏' : '展开侧栏'"
          @click="toggleSidePanel"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path :d="sidePanelOpen ? 'M6 3l5 5-5 5' : 'M10 3l-5 5 5 5'" />
          </svg>
        </button>
      </div>

      <div class="editor-side-region" :class="{ 'editor-side-region--collapsed': !sidePanelOpen }">
        <Transition name="editor-side-panel">
          <aside v-if="sidePanelOpen" class="editor-side-panel">
          <section class="editor-side-section">
            <div class="editor-side-label">摘要</div>
            <textarea
              v-model="summaryModel"
              class="editor-side-input"
              :disabled="disabledState"
              rows="4"
              :maxlength="ARTICLE_SUMMARY_MAX_LENGTH"
              placeholder="一句话介绍这篇文章..."
            />
            <p v-if="errors.summary" class="editor-field-error editor-field-error--side">
              {{ errors.summary }}
            </p>
            <p class="editor-side-counter">{{ summaryCountText }}</p>
          </section>

          <section class="editor-side-section">
            <div class="editor-side-label">封面图</div>

            <ImageUploadPreview
              :url="form.coverUrl || null"
              :color="form.coverColor || null"
              :removable="Boolean(form.coverUrl) && !disabledState"
              empty-text="点击下方按钮上传封面图"
              @remove="
                form.coverUrl = '';
                form.coverColor = '';
                handleFormMutation();
              "
            />

            <div class="mt-3">
              <ImageUploadButton
                biz-type="COVER"
                :article-id="workingArticleId"
                :disabled="disabledState"
                button-text="上传封面图"
                variant="secondary"
                @uploaded="
                  form.coverUrl = $event.url;
                  form.coverColor = $event.dominantColor ?? '';
                  handleFormMutation();
                "
                @error="emit('error', $event)"
              />
            </div>

            <p class="editor-cover-hint">建议图片大小<5MB ，支持 JPG、PNG、WebP。</p>
          </section>
          </aside>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-workbench {
  --editor-canvas-width: 44rem;
  --editor-side-width: 17.5rem;
  --editor-side-gap: 1rem;
  --editor-side-toggle-width: 2.25rem;
  --editor-toolbar-width: 3rem;
  --editor-toolbar-gap: 1rem;
  --editor-side-fixed-top: calc(var(--editor-topbar-height, 3.25rem) + var(--editor-sticky-gap, 0.32rem));
  --editor-side-motion-duration: 320ms;
  --editor-side-motion-ease: cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  min-height: 0;
  height: 100%;
  flex: 1;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text-faint) 42%, transparent) transparent;
}

.editor-workbench::-webkit-scrollbar {
  width: 0.35rem;
}

.editor-workbench::-webkit-scrollbar-track {
  background: transparent;
}

.editor-workbench::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-faint) 42%, transparent);
}

.editor-workbench::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-text-faint) 62%, transparent);
}

.editor-main-shell {
  display: grid;
  position: relative;
  min-width: 0;
  min-height: 100%;
  width: 100%;
  flex: 1;
  align-items: start;
  grid-template-columns: minmax(0, 1fr) var(--editor-side-toggle-width) auto;
  column-gap: var(--editor-side-gap);
}

.editor-left-rail {
  /* 左侧插入栏：固定在视口纵向中线，不随画布滚动 */
  display: none;
  position: fixed;
  top: 50vh;
  /* 向画布内侧收一点，减少与正文的视觉距离 */
  left: max(3rem, calc((100vw - var(--editor-canvas-width) - var(--editor-toolbar-width) - var(--editor-side-width) - var(--editor-side-gap) - var(--editor-side-toggle-width)) / 2 + 7rem));
  z-index: 8;
  transform: translateY(-50%);
}

.editor-content-region {
  --editor-content-reserve-right: calc(
    var(--editor-side-width) + var(--editor-side-gap) + var(--editor-side-toggle-width)
  );
  min-width: 0;
  padding-left: 0;
  padding-right: var(--editor-content-reserve-right);
  transition:
    padding-right 300ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

.editor-main-shell--side-collapsed .editor-content-region {
  padding-right: var(--editor-content-reserve-right);
}

.editor-canvas-region {
  position: relative;
  min-height: 100%;
  width: min(100%, calc(var(--editor-canvas-width) + var(--editor-toolbar-width) + var(--editor-toolbar-gap)));
  margin: 0 auto;
  transform: translateX(calc(var(--editor-content-reserve-right, 0px) / 2));
  transition:
    width 300ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

.editor-insert-bar {
  position: absolute;
  left: 0;
  top: 50%;
  z-index: 2;
  display: flex;
  width: var(--editor-toolbar-width);
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  transform: translateY(-50%);
}

.editor-insert-bar--canvas {
  display: none;
}

.editor-insert-item {
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  background: color-mix(in srgb, var(--color-surface-elevated) 70%, transparent);
  color: color-mix(in srgb, var(--color-text-faint) 90%, transparent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18), 0 0 0 0.5px rgba(255, 255, 255, 0.04) inset;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease,
    opacity 160ms ease;
}

.editor-insert-item:hover:not(:disabled) {
  color: var(--color-text);
  border-color: color-mix(in srgb, var(--color-border-strong) 90%, white 10%);
  background: color-mix(in srgb, var(--color-surface-elevated) 95%, white 5%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.22), 0 0 0 0.5px rgba(255, 255, 255, 0.06) inset;
  transform: translateX(2px);
}

.editor-insert-item:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.editor-insert-icon {
  display: inline-flex;
  width: 2.125rem;
  height: 2.125rem;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.editor-insert-icon svg {
  width: 0.95rem;
  height: 0.95rem;
}

.editor-insert-label {
  max-width: 0;
  overflow: hidden;
  padding-right: 0;
  font-size: 0.75rem;
  transition:
    max-width 180ms ease,
    padding-right 180ms ease;
}

.editor-insert-item:hover .editor-insert-label {
  max-width: 4.75rem;
  padding-right: 0.85rem;
}

.editor-canvas-shell {
  min-width: 0;
  width: min(var(--editor-canvas-width), calc(100% - var(--editor-toolbar-width) - var(--editor-toolbar-gap)));
  margin-left: calc(var(--editor-toolbar-width) + var(--editor-toolbar-gap));
  margin-right: auto;
  padding: 1.75rem 0 2rem;
  transition:
    width 300ms cubic-bezier(0.22, 1, 0.36, 1),
    margin 300ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

.editor-returned-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin: 0 auto 1.5rem;
  max-width: var(--editor-canvas-width);
  border: 1px solid color-mix(in srgb, var(--color-warning) 35%, transparent);
  border-left-width: 3px;
  border-left-color: var(--color-warning);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface));
  padding: 0.9rem 1rem;
}

.editor-returned-icon {
  margin-top: 0.1rem;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--color-warning);
}

.editor-returned-label {
  margin-bottom: 0.2rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-warning);
}

.editor-returned-text {
  font-size: 0.92rem;
  line-height: 1.7;
  color: var(--color-text);
}

.editor-canvas {
  margin: 0;
  max-width: none;
}

.editor-title-textarea {
  display: block;
  width: 100%;
  resize: none;
  overflow: hidden;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: clamp(2rem, 3vw, 2.6rem);
  line-height: 1.28;
  letter-spacing: -0.03em;
  outline: none;
  font-family:
    "Iowan Old Style",
    "Noto Serif SC",
    "Songti SC",
    "STSong",
    Georgia,
    serif;
}

.editor-title-textarea::placeholder {
  color: var(--color-text-faint);
}

.editor-title-count {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-faint);
}

.editor-canvas-separator {
  width: 2.5rem;
  height: 2px;
  margin: 1.5rem 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border-strong) 55%, transparent);
}

.editor-format-toolbar {
  position: sticky;
  top: var(--editor-sticky-gap, 0.32rem);
  z-index: 6;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 1rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface-elevated) 75%, transparent);
  padding: 0.65rem;
  backdrop-filter: blur(12px);
}

.editor-format-toolbar:not(.editor-format-toolbar--icons) {
  display: none;
}

.editor-format-toolbar--icons {
  display: flex;
}

.editor-tool-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  position: relative;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  padding: 0;
  color: var(--color-text-faint);
  font-size: 0;
  line-height: 0;
  white-space: nowrap;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    opacity 160ms ease;
}

.editor-tool-button::before {
  content: "";
  width: 0.98rem;
  height: 0.98rem;
  display: block;
  background-color: currentColor;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
}

.editor-tool-button::after {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.55rem);
  transform: translate(-50%, 6px);
  opacity: 0;
  pointer-events: none;
  z-index: 12;
  padding: 0.38rem 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--color-text);
  color: var(--color-surface);
  font-size: 0.72rem;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  transition:
    opacity 140ms ease,
    transform 160ms ease;
}

.editor-tool-button:hover::after,
.editor-tool-button:focus-visible::after {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* 工具栏吸顶时，tooltip 改为向下展示，避免被视口裁剪 */
.editor-format-toolbar.is-stuck .editor-tool-button::after {
  bottom: auto;
  top: calc(100% + 0.55rem);
  transform: translate(-50%, -6px);
}

.editor-format-toolbar.is-stuck .editor-tool-button:hover::after,
.editor-format-toolbar.is-stuck .editor-tool-button:focus-visible::after {
  transform: translate(-50%, 0);
}

.editor-format-toolbar.editor-format-toolbar--icons > .editor-tool-button[data-tooltip]::before {
  content: none;
  display: none;
}

.editor-format-toolbar.editor-format-toolbar--icons > .editor-tool-button[data-tooltip]::after {
  content: attr(data-tooltip);
}

.editor-heading-dropdown > .editor-tool-button[data-tooltip]::before {
  content: none;
  display: none;
}

.editor-heading-dropdown > .editor-tool-button[data-tooltip]::after {
  content: attr(data-tooltip);
}

.editor-format-toolbar--icons .editor-tool-button svg {
  width: 1rem;
  height: 1rem;
  display: block;
}

.editor-tool-button--heading {
  width: auto;
  min-width: 3.25rem;
  justify-content: center;
  padding: 0 1.35rem 0 0.4rem;
  font-size: 0.78rem;
  line-height: 1;
}

.editor-heading-dropdown {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}

.editor-heading-trigger__badge {
  display: inline-flex;
  min-width: 1.7rem;
  height: 1.3rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  padding: 0 0.42rem;
  color: var(--color-text);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.editor-tool-button-caret {
  position: absolute;
  top: 50%;
  right: 0.38rem;
  width: 0.62rem;
  height: 0.62rem;
  opacity: 0.72;
  transform: translateY(-50%);
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.editor-tool-button--heading[aria-expanded='true'] .editor-tool-button-caret {
  opacity: 1;
  transform: translateY(-50%) rotate(180deg);
}

.editor-toolbar-dropdown-menu {
  position: absolute;
  top: calc(100% + 0.3rem);
  left: 0;
  z-index: 14;
  display: grid;
  width: max-content;
  min-width: 0;
  gap: 0;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 72%, transparent);
  border-radius: calc(var(--radius-md) - 4px);
  background: var(--color-surface-elevated);
  padding: 0.2rem 0;
  box-shadow: 0 14px 28px color-mix(in srgb, var(--color-text) 9%, transparent);
  backdrop-filter: none;
}

.editor-toolbar-dropdown-item {
  display: inline-flex;
  position: relative;
  width: 100%;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 0.48rem 0.9rem;
  color: var(--color-text-faint);
  font-size: 0.72rem;
  line-height: 1.1;
  text-align: center;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    opacity 160ms ease;
}

.editor-toolbar-dropdown-item + .editor-toolbar-dropdown-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  width: 1rem;
  height: 1px;
  background: color-mix(in srgb, var(--color-border-strong) 72%, transparent);
  transform: translateX(-50%);
}

.editor-toolbar-dropdown-item__badge {
  display: inline-flex;
  min-width: 0;
  height: auto;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 0;
  background: none;
  color: var(--color-text);
  font-size: 0.84rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.editor-toolbar-dropdown-item:hover:not(:disabled) {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface) 72%, black 2%);
}

.editor-toolbar-dropdown-item:disabled {
  opacity: 0.45;
}

.editor-toolbar-dropdown-item--active {
  background: color-mix(in srgb, var(--color-surface) 74%, black 3%);
  color: var(--color-text);
}

.editor-toolbar-dropdown-item--active .editor-toolbar-dropdown-item__badge {
  font-weight: 700;
}

.editor-toolbar-dropdown-menu-enter-active,
.editor-toolbar-dropdown-menu-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms ease;
}

.editor-toolbar-dropdown-menu-enter-from,
.editor-toolbar-dropdown-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(1)::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M3 4.5h10M3 8h10M3 11.5h10'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M3 4.5h10M3 8h10M3 11.5h10'/%3E%3C/svg%3E");
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(1)::after {
  content: "正文";
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(2)::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 4v8M10 4v8M4 8h6M12 5v6M11 5h3'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 4v8M10 4v8M4 8h6M12 5v6M11 5h3'/%3E%3C/svg%3E");
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(2)::after {
  content: "标题";
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(3)::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 3.5h3.2a2.3 2.3 0 1 1 0 4.6H5zM5 8.1h3.8a2.4 2.4 0 1 1 0 4.8H5z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 3.5h3.2a2.3 2.3 0 1 1 0 4.6H5zM5 8.1h3.8a2.4 2.4 0 1 1 0 4.8H5z'/%3E%3C/svg%3E");
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(3)::after {
  content: "加粗";
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(4)::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M9.5 3.5 6.5 12.5M5.5 3.5h6M4.5 12.5h6'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M9.5 3.5 6.5 12.5M5.5 3.5h6M4.5 12.5h6'/%3E%3C/svg%3E");
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(4)::after {
  content: "斜体";
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(5)::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M7 4.5h6M7 8h6M7 11.5h6'/%3E%3Ccircle cx='4' cy='4.5' r='0.8' fill='black' stroke='none'/%3E%3Ccircle cx='4' cy='8' r='0.8' fill='black' stroke='none'/%3E%3Ccircle cx='4' cy='11.5' r='0.8' fill='black' stroke='none'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M7 4.5h6M7 8h6M7 11.5h6'/%3E%3Ccircle cx='4' cy='4.5' r='0.8' fill='black' stroke='none'/%3E%3Ccircle cx='4' cy='8' r='0.8' fill='black' stroke='none'/%3E%3Ccircle cx='4' cy='11.5' r='0.8' fill='black' stroke='none'/%3E%3C/svg%3E");
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(5)::after {
  content: "无序列表";
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(6)::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 4h1v3M2.2 11.5h1.8L2.4 13h1.8M7 4.5h6M7 8h6M7 11.5h6'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 4h1v3M2.2 11.5h1.8L2.4 13h1.8M7 4.5h6M7 8h6M7 11.5h6'/%3E%3C/svg%3E");
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(6)::after {
  content: "有序列表";
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(7)::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 4 2.5 7.5 6 11M3 7.5h5.5a4 4 0 1 1 0 8'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 4 2.5 7.5 6 11M3 7.5h5.5a4 4 0 1 1 0 8'/%3E%3C/svg%3E");
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(7)::after {
  content: "撤销";
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(8)::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 4 13.5 7.5 10 11M13 7.5H7.5a4 4 0 1 0 0 8'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 4 13.5 7.5 10 11M13 7.5H7.5a4 4 0 1 0 0 8'/%3E%3C/svg%3E");
}

.editor-format-toolbar > .editor-tool-button:nth-of-type(8)::after {
  content: "重做";
}

.editor-tool-button:hover:not(:disabled) {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface) 75%, transparent);
}

.editor-tool-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.editor-tool-button--active {
  border-color: color-mix(in srgb, var(--color-border-strong) 75%, transparent);
  background: color-mix(in srgb, var(--color-surface) 88%, white 4%);
  color: var(--color-text);
}

.editor-tool-button--ghost {
  color: color-mix(in srgb, var(--color-text-faint) 92%, transparent);
}

.editor-format-divider {
  width: 1px;
  align-self: stretch;
  background: color-mix(in srgb, var(--color-border) 70%, transparent);
}

.editor-content-editor-shell {
  min-height: 25rem;
  border-radius: calc(var(--radius-lg) + 2px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 94%, transparent), color-mix(in srgb, var(--color-surface) 84%, transparent));
  transition:
    opacity 160ms ease;
}

.editor-content-editor-shell:focus-within {
  outline: none;
}

.editor-content-editor-shell.is-disabled {
  opacity: 0.72;
}

.editor-content-editor {
  width: 100%;
}

.editor-content-editor :deep(.editor-content-surface) {
  min-height: 25rem;
  padding: 1.15rem 1.1rem 1.4rem;
  color: var(--color-text);
  font-size: 1rem;
  line-height: 1.95;
  letter-spacing: -0.01em;
  outline: none;
  font-family: var(--font-sans);
}

.editor-content-editor :deep(.editor-content-surface > :first-child) {
  margin-top: 0;
}

.editor-content-editor :deep(.editor-content-surface > :last-child) {
  margin-bottom: 0;
}

.editor-content-editor :deep(.editor-content-surface p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--color-text-faint);
}

.editor-content-editor :deep(.editor-content-surface h2) {
  margin: 1.4rem 0 0.85rem;
  color: var(--color-text);
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.35;
}

.editor-content-editor :deep(.editor-content-surface h3) {
  margin: 1.2rem 0 0.7rem;
  color: var(--color-text);
  font-size: 1.24rem;
  font-weight: 700;
  line-height: 1.4;
}

.editor-content-editor :deep(.editor-content-surface h4) {
  margin: 1rem 0 0.65rem;
  color: color-mix(in srgb, var(--color-text) 92%, var(--color-text-faint));
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.45;
}

.editor-content-editor :deep(.editor-content-surface p),
.editor-content-editor :deep(.editor-content-surface ul),
.editor-content-editor :deep(.editor-content-surface ol),
.editor-content-editor :deep(.editor-content-surface blockquote),
.editor-content-editor :deep(.editor-content-surface pre),
.editor-content-editor :deep(.editor-content-surface hr) {
  margin: 0 0 1rem;
}

.editor-content-editor :deep(.editor-content-surface ul),
.editor-content-editor :deep(.editor-content-surface ol) {
  padding-left: 1.4rem;
}

.editor-content-editor :deep(.editor-content-surface ul) {
  list-style: disc;
}

.editor-content-editor :deep(.editor-content-surface ol) {
  list-style: decimal;
}

.editor-content-editor :deep(.editor-content-surface li) {
  display: list-item;
  margin: 0.3rem 0;
}

.editor-content-editor :deep(.editor-content-surface li::marker) {
  color: color-mix(in srgb, var(--color-text) 72%, var(--color-text-faint));
}

.editor-content-editor :deep(.editor-content-surface blockquote) {
  border-left: 3px solid color-mix(in srgb, var(--color-border-strong) 75%, transparent);
  padding-left: 1rem;
  color: color-mix(in srgb, var(--color-text) 84%, var(--color-text-faint));
}

.editor-content-editor :deep(.editor-content-surface pre) {
  overflow-x: auto;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-elevated) 92%, black 8%);
  padding: 0.95rem 1rem;
  font-size: 0.92rem;
  line-height: 1.75;
}

.editor-content-editor :deep(.editor-content-surface code) {
  font-family: var(--font-mono, "SFMono-Regular", Consolas, monospace);
}

.editor-content-editor :deep(.editor-content-surface hr) {
  border: none;
  border-top: 1px solid color-mix(in srgb, var(--color-border-strong) 70%, transparent);
}

.editor-content-editor :deep(.editor-content-surface mark) {
  border-radius: 0.22rem;
  background: color-mix(in srgb, var(--color-warning) 22%, transparent);
  padding: 0.02em 0.18em;
}

.editor-content-editor :deep(.editor-content-surface em),
.editor-content-editor :deep(.editor-content-surface i) {
  font-style: italic;
  font-synthesis: style;
}

.editor-content-editor :deep(.editor-content-surface a) {
  color: var(--color-primary);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

.editor-content-editor :deep(.editor-content-surface a:hover) {
  color: var(--color-primary-strong);
}

.editor-content-editor :deep(.editor-content-surface img) {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-lg);
}

.editor-content-editor :deep(.editor-resizable-image) {
  display: flex;
  justify-content: center;
  margin: 0 0 1rem;
}

.editor-content-editor :deep(.editor-resizable-image__frame) {
  position: relative;
  max-width: 100%;
  line-height: 0;
}

.editor-content-editor :deep(.editor-resizable-image__frame img) {
  width: 100%;
  max-width: 100%;
  height: auto;
}

.editor-content-editor :deep(.editor-resizable-image.is-selected .editor-resizable-image__frame) {
  outline: none;
  border-radius: calc(var(--radius-lg) + 0.1rem);
}

.editor-content-editor :deep(.editor-resizable-image.is-resizing .editor-resizable-image__frame) {
  cursor: ew-resize;
}

.editor-content-editor :deep(.editor-resizable-image__handle) {
  position: absolute;
  width: 0.75rem;
  height: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 72%, transparent);
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text) 10%, transparent);
}

.editor-content-editor :deep(.editor-resizable-image__handle--nw) {
  top: -0.4rem;
  left: -0.4rem;
  cursor: nwse-resize;
}

.editor-content-editor :deep(.editor-resizable-image__handle--ne) {
  top: -0.4rem;
  right: -0.4rem;
  cursor: nesw-resize;
}

.editor-content-editor :deep(.editor-resizable-image__handle--sw) {
  bottom: -0.4rem;
  left: -0.4rem;
  cursor: nesw-resize;
}

.editor-content-editor :deep(.editor-resizable-image__handle--se) {
  right: -0.4rem;
  bottom: -0.4rem;
  cursor: nwse-resize;
}

.editor-content-editor :deep(.editor-content-surface table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 1rem;
  table-layout: fixed;
  overflow: hidden;
}

.editor-content-editor :deep(.editor-content-surface th),
.editor-content-editor :deep(.editor-content-surface td) {
  position: relative;
  min-width: 3rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 65%, transparent);
  text-align: left;
  vertical-align: top;
  font-size: 0.95rem;
  line-height: 1.7;
}

.editor-content-editor :deep(.editor-content-surface th) {
  background: color-mix(in srgb, var(--color-surface-elevated) 85%, transparent);
  font-weight: 600;
  color: var(--color-text);
}

.editor-content-editor :deep(.editor-content-surface td) {
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  color: var(--color-text);
}

.editor-content-editor :deep(.editor-content-surface .selectedCell::after) {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  z-index: 2;
}

.editor-wordcount {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
  font-size: 0.76rem;
  color: color-mix(in srgb, var(--color-text-faint) 85%, transparent);
}

.editor-side-region {
  position: fixed;
  top: var(--editor-side-fixed-top);
  bottom: 0;
  right: 0;
  z-index: 5;
  min-width: 0;
  width: var(--editor-side-width);
  transform: translateX(0);
  transition:
    width var(--editor-side-motion-duration) var(--editor-side-motion-ease),
    opacity var(--editor-side-motion-duration) var(--editor-side-motion-ease),
    transform var(--editor-side-motion-duration) var(--editor-side-motion-ease);
}

.editor-side-region--collapsed {
  width: 0;
  opacity: 0;
  transform: translateX(12px);
  pointer-events: none;
}

.editor-side-toggle-anchor {
  position: fixed;
  top: var(--editor-side-fixed-top);
  right: var(--editor-side-width);
  z-index: 7;
  display: flex;
  min-width: var(--editor-side-toggle-width);
  justify-content: flex-end;
  margin-right: 0;
  transition:
    right var(--editor-side-motion-duration) var(--editor-side-motion-ease),
    transform var(--editor-side-motion-duration) var(--editor-side-motion-ease);
}

.editor-side-toggle-anchor--collapsed {
  right: 0;
}

.editor-side-toggle {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: 1.7rem;
  height: 1.7rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px 0 0 999px;
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  border-right: none;
  background: color-mix(in srgb, var(--color-surface-elevated) 90%, transparent);
  color: var(--color-text-faint);
  box-shadow: -2px 0 6px rgba(0, 0, 0, 0.15);
  transition:
    color 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow var(--editor-side-motion-duration) var(--editor-side-motion-ease),
    transform var(--editor-side-motion-duration) var(--editor-side-motion-ease);
}

.editor-side-toggle:hover {
  color: var(--color-text);
  border-color: color-mix(in srgb, var(--color-border-strong) 90%, white 5%);
  background: color-mix(in srgb, var(--color-surface-elevated) 100%, white 4%);
}

.editor-side-toggle svg {
  width: 0.7rem;
  height: 0.7rem;
}

.editor-side-panel {
  position: relative;
  display: flex;
  min-height: 100%;
  height: 100%;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  border-left: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: color-mix(in srgb, var(--color-surface-elevated) 72%, transparent);
  transform-origin: right center;
  will-change: opacity, transform;
}

.editor-side-panel-enter-active,
.editor-side-panel-leave-active {
  transition:
    opacity var(--editor-side-motion-duration) var(--editor-side-motion-ease),
    transform var(--editor-side-motion-duration) var(--editor-side-motion-ease);
}

.editor-side-panel-enter-from,
.editor-side-panel-leave-to {
  opacity: 0;
  transform: translateX(14px) scaleX(0.98);
}

.editor-side-section {
  padding: 1.25rem 1.25rem 1.1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
}

.editor-side-section:last-child {
  border-bottom: none;
}

.editor-side-label {
  margin-bottom: 0.7rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-faint);
}

.editor-side-input {
  width: 100%;
  resize: vertical;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 75%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-surface) 65%, transparent);
  padding: 0.75rem 0.85rem;
  color: var(--color-text);
  font-size: 0.88rem;
  line-height: 1.7;
  outline: none;
  transition: border-color 160ms ease, background-color 160ms ease;
  font-family: var(--font-sans);
}

.editor-side-input:focus {
  border-color: color-mix(in srgb, var(--color-text-faint) 55%, var(--color-border-strong));
  background: color-mix(in srgb, var(--color-surface) 80%, transparent);
}

.editor-side-input::placeholder {
  color: var(--color-text-faint);
}

.editor-side-counter {
  margin-top: 0.45rem;
  text-align: right;
  font-size: 0.74rem;
  color: var(--color-text-faint);
}

.editor-cover-hint {
  margin-top: 0.75rem;
  font-size: 0.74rem;
  line-height: 1.6;
  color: var(--color-text-faint);
}

.editor-field-error {
  margin-top: 0.55rem;
  font-size: 0.8rem;
  color: var(--color-danger);
}

.editor-field-error--side {
  margin-top: 0.5rem;
}

@media (max-width: 1100px) {
  .editor-workbench {
    --editor-side-width: 15rem;
    --editor-side-gap: 1rem;
    --editor-toolbar-gap: 0.85rem;
  }
}

@media (max-width: 960px) {
  .editor-workbench {
    flex-direction: column;
  }

  .editor-tool-button--heading {
    min-width: 3rem;
  }

  .editor-toolbar-dropdown-menu {
    width: max-content;
  }

  .editor-main-shell {
    display: flex;
    flex-direction: column;
  }

  .editor-content-region {
    --editor-content-reserve-right: 0px;
    padding-left: 0;
    padding-right: 0;
  }

  .editor-canvas-region {
    width: 100%;
  }

  .editor-insert-bar {
    position: static;
    transform: none;
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-bottom: 1rem;
  }

  .editor-insert-bar--canvas {
    display: flex;
  }

  .editor-canvas-shell {
    width: 100%;
    margin-left: 0;
  }

  .editor-side-toggle-anchor {
    display: none;
  }

  .editor-side-region,
  .editor-side-region--collapsed {
    position: static;
    width: 100%;
    max-height: none;
    opacity: 1;
    pointer-events: auto;
  }

  .editor-side-panel {
    max-height: none;
    overflow: visible;
    border-left: none;
    border-top: 1px solid var(--color-border);
  }

  /* 小屏隐藏左侧固定栏 */
  .editor-left-rail {
    display: none !important;
  }
}

/* 大屏（>960px）时显示左侧固定插入栏 */
@media (min-width: 961px) {
  .editor-left-rail {
    display: block;
  }

  /* 左侧栏内的 .editor-insert-bar 使用固定定位的父元素，
     所以这里让内部 bar 恢复相对父容器定位 */
  .editor-left-rail .editor-insert-bar--rail {
    position: static;
    transform: none;
    width: auto;
  }
}

/* 哨兵元素：零高度，工具栏上方，用于 IntersectionObserver 检测吸顶 */
.editor-toolbar-sentinel {
  height: 1px;
  margin-bottom: -1px;
  pointer-events: none;
  visibility: hidden;
}

/* 表格下拉触发按钮：图标徽标 */
.editor-table-trigger__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.3rem;
  padding: 0;
  background: none;
  border-radius: 0;
}

.editor-table-trigger__badge svg {
  width: 0.88rem;
  height: 0.88rem;
}

/* 表格下拉菜单：比标题菜单稍宽，选项左对齐 */
.editor-table-dropdown-menu {
  min-width: 9rem;
}

.editor-table-dropdown-item {
  justify-content: flex-start !important;
  gap: 0.6rem;
  padding-left: 0.75rem !important;
  padding-right: 0.9rem !important;
  font-size: 0.82rem !important;
  text-align: left !important;
}

.editor-table-dropdown-item__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.1rem;
  color: var(--color-text-muted);
}

.editor-table-dropdown-item__icon svg {
  width: 1.3rem;
  height: 1rem;
}

.editor-table-dropdown-item:hover:not(:disabled) .editor-table-dropdown-item__icon {
  color: var(--color-text);
}
</style>
