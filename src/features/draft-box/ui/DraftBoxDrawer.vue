<script setup lang="ts">
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

const items = ref<DraftBoxItem[]>([])
const errorMessage = ref('')
const pendingWarning = ref('')
const deletingId = ref<number | string | null>(null)
const draftCountText = computed(() => `${items.value.length} 篇`)
const panelLoading = computed(() => draftStore.loading && !draftStore.initialized)
const panelClass = computed(() => (panelLoading.value ? 'min-h-[13rem]' : 'min-h-0'))
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

function syncItemsFromDraftStore() {
  if (!draftStore.initialized) {
    if (draftStore.items.length === 0) {
      items.value = []
    }
    return
  }

  items.value = draftStore.items.map(mapCachedDraftToItem)
  prefetchRecentDraftDetails(items.value)
}

function closeMenu() {
  emit('update:modelValue', false)
}

async function goCreateArticle() {
  closeMenu()
  await nextTick()
  await router.push({ name: ROUTE_NAME.ARTICLE_EDITOR_NEW })
}

async function prefetchDraftDetail(articleId: number | string) {
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
  closeMenu()
  await prefetchDraftDetail(item.id)
  await nextTick()
  emit('open-editor', item)
}

async function removeDraft(item: DraftBoxItem) {
  if (!item.canDelete) return

  deletingId.value = item.id

  try {
    await deleteDraftById(item.id)

    const next = items.value.filter((draft) => draft.id !== item.id)
    items.value = next
    syncDraftStore(draftStore, next)

    // 使用户个人页文章列表缓存失效，确保个人页数据同步更新
    void queryClient.invalidateQueries({ queryKey: queryKeys.userProfileRoot })

    toast.success('文章已删除')
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
</script>

<template>
  <div
    v-bind="attrs"
    class="draft-box-panel surface-1 absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-xl)] p-3 shadow-[var(--shadow-lg)]"
    :class="[panelClass, modelValue ? 'draft-box-panel--open' : '']"
    role="dialog"
    aria-modal="false"
    aria-label="写作箱"
    :aria-hidden="!modelValue"
    tabindex="-1"
  >
    <div class="mb-3 px-1">
      <h3 class="text-base font-semibold tracking-[-0.02em] text-[var(--color-text)]">
        写作箱 · {{ draftCountText }}
      </h3>
    </div>

    <DraftList
      class="draft-box-panel__body"
      :items="items"
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
</template>

<style scoped>
.draft-box-panel {
  display: flex;
  max-height: min(calc(100vh - var(--header-height, 4rem) - 2rem), 34rem);
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface-panel);
  border-color: var(--color-border-panel);
  -webkit-backdrop-filter: blur(var(--backdrop-blur-panel)) saturate(180%);
  backdrop-filter: blur(var(--backdrop-blur-panel)) saturate(180%);
  opacity: 0;
  pointer-events: none;
  transform: translateY(0.25rem);
  visibility: hidden;
  transition:
    opacity 180ms ease,
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0s linear 200ms;
}

.draft-box-panel--open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
  visibility: visible;
  transition:
    opacity 220ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0s;
}

.draft-box-panel__body {
  min-height: 0;
  flex: 1 1 auto;
}

</style>
