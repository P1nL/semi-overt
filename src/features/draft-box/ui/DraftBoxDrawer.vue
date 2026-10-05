<script setup lang="ts">
import DraftBungeeTransition from './DraftBungeeTransition.vue'
import { computed, nextTick, ref, useAttrs, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'

import type { ArticleCardVm } from '@/entities/article'
import {
  deleteDraftById,
  loadDraftBoxItems,
  syncDraftStore,
  type DraftBoxItem,
} from '@/features/draft-box/model'
import { queryKeys } from '@/shared/api/queryKeys'
import { Spinner } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'
import { ARTICLE_STATUS } from '@/shared/constants/article'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import { useDraftStore } from '@/stores/draft'
import { useEditorStore } from '@/stores/editor'
import DraftList from './DraftList.vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  modelValue: boolean
  previewItems?: DraftBoxItem[]
  placement?: 'bottom' | 'left'
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'open-editor': [DraftBoxItem]
}>()

const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()
const draftStore = useDraftStore()
const editorStore = useEditorStore()
const queryClient = useQueryClient()
const attrs = useAttrs()

const previewMode = computed(() => import.meta.env.DEV && props.previewItems !== undefined)
const items = ref<DraftBoxItem[]>([])
const errorMessage = ref('')
const pendingWarning = ref('')
const deletingId = ref<number | string | null>(null)
const draftCountText = computed(() => `${items.value.length} 篇`)
const panelLoading = computed(() => !previewMode.value && draftStore.loading && !draftStore.initialized)
const PREFETCH_DETAIL_LIMIT = 6

function mapCachedDraftToItem(item: ArticleCardVm): DraftBoxItem {
  const updatedAt = item.meta.updatedAt ?? ''

  return {
    id: item.id,
    title: item.title,
    status: item.status ?? {
      value: ARTICLE_STATUS.DRAFT,
      label: '草稿',
      variant: 'default',
    },
    wordCount: item.meta.wordCount ?? 0,
    wordCountText: item.meta.wordCountText ?? '0 字',
    updatedAt: item.meta.displayTime ?? item.meta.updatedAt ?? '',
    latestReason: item.latestReason,
    editPath: item.editPath,
    sortAtRaw: updatedAt,
    canDelete: item.status?.value !== ARTICLE_STATUS.PENDING,
  }
}

function syncCachedDraftDetails(drafts: DraftBoxItem[]) {
  for (const item of drafts) {
    const cached = editorStore.getCachedArticleDetail(item.id)
    if (!cached) continue

    const statusChanged = cached.status.value !== item.status.value
    const reasonChanged = cached.latestReviewReason !== item.latestReason
    if (!statusChanged && !reasonChanged) continue

    editorStore.patchCachedArticleDetail(item.id, {
      status: item.status,
      latestReviewReason: item.latestReason,
    })
  }
}

function syncItemsFromDraftStore() {
  if (previewMode.value) {
    items.value = [...(props.previewItems ?? [])]
    errorMessage.value = ''
    pendingWarning.value = '临时草稿数据，仅用于导航栏预览。'
    return
  }
  if (!draftStore.initialized) {
    if (draftStore.items.length === 0) {
      items.value = []
    }
    return
  }

  items.value = draftStore.items.map(mapCachedDraftToItem)
  syncCachedDraftDetails(items.value)
  prefetchRecentDraftDetails(items.value)
}

function closeMenu() {
  emit('update:modelValue', false)
}

async function goCreateArticle() {
  if (previewMode.value) {
    pendingWarning.value = '临时预览不创建真实文章，请登录后使用。'
    return
  }
  closeMenu()
  await nextTick()
  await router.push({ name: ROUTE_NAME.ARTICLE_EDITOR_NEW })
}

async function prefetchDraftDetail(articleId: number | string) {
  if (previewMode.value) return
  if (editorStore.getCachedArticleDetail(articleId)) return

  try {
    await editorStore.prefetchArticleDetail(articleId)
  } catch {
    // 预取失败不阻断打开编辑页，编辑页仍会展示原有错误处理。
  }
}

function prefetchRecentDraftDetails(drafts: DraftBoxItem[]) {
  for (const item of drafts.slice(0, PREFETCH_DETAIL_LIMIT)) {
    void prefetchDraftDetail(item.id)
  }
}

async function loadDrafts(options: { background?: boolean } = {}) {
  if (previewMode.value) {
    syncItemsFromDraftStore()
    return
  }
  if (draftStore.loading) return

  errorMessage.value = ''
  pendingWarning.value = ''

  const username = authStore.user?.username
  if (!username) {
    items.value = []
    draftStore.loading = false
    draftStore.initialized = false
    errorMessage.value = '加载写作箱失败'
    return
  }

  draftStore.loading = true

  try {
    const result = await loadDraftBoxItems(username)
    items.value = result.items
    pendingWarning.value = result.pendingWarning
    syncCachedDraftDetails(result.items)
    syncDraftStore(draftStore, result.items)
    draftStore.initialized = true
    prefetchRecentDraftDetails(result.items)
  } catch (error) {
    if (!options.background || !draftStore.initialized) {
      errorMessage.value = getErrorMessage(error, '加载写作箱失败')
    }
  } finally {
    draftStore.loading = false
  }
}

async function openEditor(item: DraftBoxItem) {
  if (previewMode.value) {
    pendingWarning.value = '临时草稿仅用于预览，不会打开真实编辑页。'
    return
  }
  closeMenu()
  await prefetchDraftDetail(item.id)
  await nextTick()
  emit('open-editor', item)
}

async function removeDraft(item: DraftBoxItem) {
  if (!item.canDelete) return
  if (previewMode.value) {
    items.value = items.value.filter(draft => draft.id !== item.id)
    return
  }

  deletingId.value = item.id

  try {
    await deleteDraftById(item.id)

    const next = items.value.filter((draft) => draft.id !== item.id)
    items.value = next
    syncDraftStore(draftStore, next)

    // 使用户个人页文章列表缓存失效，确保个人页数据同步更新
    void queryClient.invalidateQueries({ queryKey: queryKeys.userProfileRoot })
  } catch (error) {
    toast.error(getErrorMessage(error, '删除文章失败'))
  } finally {
    deletingId.value = null
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      syncItemsFromDraftStore()
      void loadDrafts({ background: draftStore.initialized })
    }
  },
)

watch(
  () => [draftStore.initialized, draftStore.items] as const,
  () => {
    syncItemsFromDraftStore()
  },
  { immediate: true, deep: true },
)

watch(
  () => authStore.user?.username,
  (username) => {
    if (previewMode.value) {
      syncItemsFromDraftStore()
      return
    }
    if (!username) {
      items.value = []
      errorMessage.value = ''
      pendingWarning.value = ''
      draftStore.loading = false
      draftStore.initialized = false
      return
    }

    if (!draftStore.initialized) {
      void loadDrafts({ background: true })
    }
  },
  { immediate: true },
)
watch(
  () => props.previewItems,
  () => {
    if (previewMode.value) syncItemsFromDraftStore()
    else if (props.modelValue) {
      syncItemsFromDraftStore()
      void loadDrafts({ background: draftStore.initialized })
    }
  },
)
</script>

<template>
  <DraftBungeeTransition :open="modelValue" :appear="modelValue" :placement="placement">
  <div
    v-show="modelValue"
    data-title-effect-occluder
    :inert="!modelValue"
    v-bind="attrs"
    class="draft-box-panel absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-xl)] p-4 max-md:fixed max-md:inset-x-3 max-md:top-20 max-md:w-auto"
    :class="modelValue ? 'draft-box-panel--open' : ''"
    role="dialog"
    aria-modal="false"
    aria-label="写作箱"
    :aria-hidden="!modelValue"
    tabindex="-1"
  >
    <div class="draft-box-panel__header" data-draft-reveal>
      <h3 class="draft-box-panel__heading">
        <span>写作箱</span>
        <Transition name="draft-count-state" mode="out-in">
          <span
            :key="panelLoading ? 'loading' : 'count'"
            class="draft-count-value"
            role="status"
            aria-live="polite"
            :aria-busy="panelLoading"
          >
            <Spinner
              v-if="panelLoading"
              size="sm"
              label="正在加载写作箱"
              class="draft-count-spinner"
            />
            <span v-else>{{ draftCountText }}</span>
          </span>
        </Transition>
      </h3>
    </div>

    <DraftList
      class="draft-box-panel__body"
      :items="items"
      :active="modelValue"
      :loading="panelLoading"
      :error="errorMessage"
      :warning="pendingWarning"
      :deleting-id="deletingId"
      create-label="新建文章"
      @open="openEditor"
      @delete="removeDraft"
      @create="goCreateArticle"
      @retry="loadDrafts"
    />
  </div>
  </DraftBungeeTransition>
</template>

<style scoped>
.draft-count-state-enter-active {
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.draft-count-state-leave-active {
  transition:
    opacity 120ms cubic-bezier(0.4, 0, 1, 1),
    transform 140ms cubic-bezier(0.4, 0, 1, 1);
}

.draft-count-state-enter-from,
.draft-count-state-leave-to {
  opacity: 0;
  transform: translateY(0.2rem) scale(0.94);
}

.draft-box-panel {
  display: flex;
  max-height: min(calc(100vh - var(--header-height, 4rem) - 2rem), 34rem);
  flex-direction: column;
  overflow: hidden;
  background: var(--color-draft-panel-bg);
  color: var(--color-draft-panel-text);
  border: 1px solid var(--color-draft-panel-border);
  box-shadow: var(--shadow-draft-panel);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.draft-box-panel__header { padding: 2px 0 14px; margin-bottom: 4px; border-bottom: 1px solid var(--color-draft-panel-border); }
.draft-box-panel__heading { display: flex; align-items: center; gap: 12px; margin: 0; color: var(--color-draft-panel-accent); font-size: 18px; font-weight: 650; letter-spacing: -0.02em; }
.draft-count-value { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 25px; margin-left: 0; flex-shrink: 0; padding: 3px 9px; border-radius: var(--radius-pill); background: var(--color-draft-panel-hover); color: var(--color-draft-panel-accent); font-size: 12px; font-weight: 500; line-height: 1.4; }
.draft-box-panel :deep(.draft-list) { gap: 0; }
.draft-box-panel :deep(.draft-item) {
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--color-draft-panel-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-draft-panel-text);
  box-shadow: none;
}
.draft-box-panel :deep(.draft-item:hover),
.draft-box-panel :deep(.draft-item:focus-within) { --draft-row-background: var(--color-draft-panel-hover); background: var(--color-draft-panel-hover); }
.draft-box-panel :deep(.draft-item h4) { color: var(--color-draft-panel-text); font-size: 15px; line-height: 1.5; font-weight: 600; }
.draft-box-panel :deep(.draft-item .mt-3 > span.text-sm) { color: var(--color-draft-panel-muted); font-size: 12px; }
.draft-box-panel :deep(.draft-item--returned) { --draft-row-background: color-mix(in srgb, var(--color-warning) 8%, var(--color-draft-panel-bg)); background: color-mix(in srgb, var(--color-warning) 8%, var(--color-draft-panel-bg)); border-bottom-color: color-mix(in srgb, var(--color-warning) 35%, var(--color-draft-panel-border)); }
.draft-box-panel :deep(.draft-create-card) {
  min-height: 56px;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--color-draft-create-bg);
  color: var(--color-draft-create-fg);
}
.draft-box-panel :deep(.draft-create-card:hover),
.draft-box-panel :deep(.draft-create-card:active) { background: var(--color-draft-create-hover); }
.draft-box-panel :deep(.draft-create-card > span) { color: var(--color-draft-create-fg); }
.draft-box-panel :deep(.draft-create-card__icon) { background: color-mix(in srgb, var(--color-draft-create-fg) 10%, transparent); }
.draft-box-panel :deep(.draft-create-card:focus-visible) { outline: 2px solid var(--color-draft-panel-accent); outline-offset: 3px; }

.draft-box-panel__body {
  min-height: 0;
  flex: 1 1 auto;
}

@media (prefers-reduced-motion: reduce) {
  .draft-count-state-enter-active,
  .draft-count-state-leave-active {
    transition-duration: 1ms;
  }

  .draft-count-state-enter-from,
  .draft-count-state-leave-to {
    transform: none;
  }

  .draft-count-spinner :deep([aria-hidden='true']) {
    animation-duration: 1.6s;
  }
}

</style>
