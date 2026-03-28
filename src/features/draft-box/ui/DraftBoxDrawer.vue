<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  deleteDraftById,
  loadDraftBoxItems,
  syncDraftStore,
  type DraftBoxItem,
} from '@/features/draft-box/model'
import { useToast } from '@/shared/composables/useToast'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import { useDraftStore } from '@/stores/draft'
import DraftList from './DraftList.vue'

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

const items = ref<DraftBoxItem[]>([])
const errorMessage = ref('')
const pendingWarning = ref('')
const deletingId = ref<number | string | null>(null)
const draftCountText = computed(() => `${items.value.length} 篇`)
const panelLoading = computed(() => draftStore.loading && !draftStore.initialized)
const panelClass = computed(() => (panelLoading.value ? 'min-h-[13rem]' : 'min-h-0'))

function closeMenu() {
  emit('update:modelValue', false)
}

async function goCreateArticle() {
  closeMenu()
  await router.push({ name: ROUTE_NAME.ARTICLE_EDITOR_NEW })
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
  } catch (error) {
    if (!options.background || !draftStore.initialized) {
      errorMessage.value = getErrorMessage(error, '加载写作箱失败')
    }
  } finally {
    draftStore.loading = false
  }
}

function openEditor(item: DraftBoxItem) {
  emit('open-editor', item)
  closeMenu()
}

async function removeDraft(item: DraftBoxItem) {
  if (!item.canDelete) return

  deletingId.value = item.id

  try {
    await deleteDraftById(item.id)

    const next = items.value.filter((draft) => draft.id !== item.id)
    items.value = next
    syncDraftStore(draftStore, next)

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
      void loadDrafts({ background: draftStore.initialized })
    }
  },
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
  <Transition
    enter-active-class="transition duration-250 ease-out"
    enter-from-class="translate-y-1 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-1 opacity-0"
  >
    <div
      v-if="modelValue"
      class="draft-box-panel surface-1 absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-xl)] p-3 shadow-[var(--shadow-lg)]"
      :class="panelClass"
    >
      <div class="mb-3 px-1">
        <h3 class="text-base font-semibold tracking-[-0.02em] text-[var(--color-text)]">
          写作箱 · {{ draftCountText }}
        </h3>
      </div>

      <DraftList
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
  </Transition>
</template>

<style scoped>
.draft-box-panel {
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  border-color: color-mix(in srgb, var(--color-border-strong) 88%, white 10%);
  -webkit-backdrop-filter: blur(26px) saturate(180%);
  backdrop-filter: blur(26px) saturate(180%);
}
</style>
