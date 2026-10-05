import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { mapArticleDetailDtoToVm } from '@/entities/article/model/article.mapper'
import type { ArticleDetailVm } from '@/entities/article/model/article.types'
import { articleApi } from '@/shared/api/modules/article'
import { canCancelReview, canSubmitArticle } from '@/shared/utils/article'
import { STORAGE_KEY } from '@/shared/constants/storage'
import { localStore } from '@/shared/utils/storage'
import { normalizeBackendDateTime } from '@/shared/utils/dateTime'

type DraftSaveReceipt = { kind: 'auto' | 'manual'; savedAt: string }

export const useEditorStore = defineStore('editor', () => {
    const currentArticle = ref<ArticleDetailVm | null>(null)
    const articleDetails = ref<Record<string, ArticleDetailVm>>({})
    const articleDetailSavedAt = ref<Record<string, string>>({})
    const intentionallyEmptySummaryArticleIds = ref<Record<string, true>>({})
    const dirty = ref(false)
    const manualSavePending = ref(false)
    const changeRevision = ref(0)
    const saveReceipts = ref<Record<string, DraftSaveReceipt>>({})
    const saving = ref(false)
    const submitting = ref(false)
    const loading = ref(false)
    const lastLoadedId = ref<string>('')
    const lastSavedAt = ref<string>('')

    const currentStatus = computed(() => currentArticle.value?.status.value ?? '')
    const canSubmit = computed(() => canSubmitArticle(currentStatus.value))
    const canCancel = computed(() => canCancelReview(currentStatus.value))

    function cacheArticleDetail(article: ArticleDetailVm, savedAt = '') {
        const articleId = String(article.id)
        articleDetails.value = {
            ...articleDetails.value,
            [articleId]: article,
        }

        if (savedAt) {
            articleDetailSavedAt.value = {
                ...articleDetailSavedAt.value,
                [articleId]: savedAt,
            }
        }
    }

    function setCurrentArticle(article: ArticleDetailVm | null, savedAt = '') {
        if (article) {
            const nextId = String(article.id)
            if (currentArticle.value && String(currentArticle.value.id) !== nextId) changeRevision.value++
        }
        currentArticle.value = article
        if (article) cacheArticleDetail(article, savedAt)
    }

    function patchCachedArticleDetail(
        articleId: number | string,
        patch: Partial<ArticleDetailVm>,
        savedAt = '',
    ) {
        const key = String(articleId)
        const cached = articleDetails.value[key]
        const current = currentArticle.value && String(currentArticle.value.id) === key
            ? currentArticle.value
            : null
        const source = current ?? cached

        if (!source) {
            return
        }

        const next = {
            ...source,
            ...patch,
        }

        articleDetails.value = {
            ...articleDetails.value,
            [key]: next,
        }

        if (current) {
            currentArticle.value = next
        }

        if (savedAt) {
            articleDetailSavedAt.value = {
                ...articleDetailSavedAt.value,
                [key]: savedAt,
            }
        }
    }

    function getCachedArticleDetail(articleId: number | string) {
        return articleDetails.value[String(articleId)] ?? null
    }

    function getCachedArticleSavedAt(articleId: number | string) {
        return articleDetailSavedAt.value[String(articleId)] ?? ''
    }

    function recordDraftSave(articleId: number | string, kind: DraftSaveReceipt['kind'], savedAt: string) {
        if (!savedAt) return
        const key = String(articleId)
        const receipt = { kind, savedAt }
        saveReceipts.value = { ...saveReceipts.value, [key]: receipt }
        articleDetailSavedAt.value = { ...articleDetailSavedAt.value, [key]: savedAt }
        if (String(currentArticle.value?.id) === key) lastSavedAt.value = savedAt
        // Only the save mode/time is persisted, never draft contents.
        try { localStore?.set(`${STORAGE_KEY.ARTICLE_SAVE_RECEIPT_PREFIX}${key}`, receipt) } catch { /* Storage may be unavailable. */ }
    }

    function getDraftSaveReceipt(articleId: number | string): { kind: DraftSaveReceipt['kind'] | 'unknown'; savedAt: string } | null {
        const key = String(articleId)
        let receipt: DraftSaveReceipt | undefined = saveReceipts.value[key]
        if (!receipt) {
            try {
                const stored = localStore?.get<Partial<DraftSaveReceipt> | null>(`${STORAGE_KEY.ARTICLE_SAVE_RECEIPT_PREFIX}${key}`, null)
                if (stored && (stored.kind === 'auto' || stored.kind === 'manual') && typeof stored.savedAt === 'string' && Number.isFinite(Date.parse(normalizeBackendDateTime(stored.savedAt) ?? ''))) {
                    receipt = { kind: stored.kind, savedAt: stored.savedAt }
                }
            } catch { /* Fall back to the server timestamp. */ }
        }
        const serverSavedAt = getCachedArticleSavedAt(key)
        // A newer server revision may have been saved on another device. Do not
        // mislabel it using an older local receipt; old drafts have no mode either.
        if (receipt && (!serverSavedAt || Date.parse(normalizeBackendDateTime(serverSavedAt) ?? '') <= Date.parse(normalizeBackendDateTime(receipt.savedAt) ?? ''))) return receipt
        return serverSavedAt ? { kind: 'unknown', savedAt: serverSavedAt } : receipt ?? null
    }

    function beginEditorSession() {
        changeRevision.value++
        dirty.value = false
        manualSavePending.value = false
    }

    function setSummaryIntentionallyEmpty(articleId: number | string, isEmpty: boolean) {
        const key = String(articleId || '')
        if (!key) return

        if (isEmpty) {
            intentionallyEmptySummaryArticleIds.value = {
                ...intentionallyEmptySummaryArticleIds.value,
                [key]: true,
            }
            return
        }

        if (!(key in intentionallyEmptySummaryArticleIds.value)) {
            return
        }

        const next = { ...intentionallyEmptySummaryArticleIds.value }
        delete next[key]
        intentionallyEmptySummaryArticleIds.value = next
    }

    function isSummaryIntentionallyEmpty(articleId: number | string) {
        const key = String(articleId || '')
        if (!key) return false
        return Boolean(intentionallyEmptySummaryArticleIds.value[key])
    }

    function setDirty(value: boolean) {
        dirty.value = value
    }

    function markChanged() {
        changeRevision.value++
        dirty.value = true
        manualSavePending.value = true
    }

    function acknowledgeManualSave(revision: number) {
        if (revision !== changeRevision.value || dirty.value) return false
        manualSavePending.value = false
        if (currentArticle.value && lastSavedAt.value) recordDraftSave(currentArticle.value.id, 'manual', lastSavedAt.value)
        return true
    }

    function setSaving(value: boolean) {
        saving.value = value
    }

    function setSubmitting(value: boolean) {
        submitting.value = value
    }

    function setLastSavedAt(value: string) {
        lastSavedAt.value = value
    }

    function resetEditorState() {
        changeRevision.value++
        manualSavePending.value = false
        currentArticle.value = null
        dirty.value = false
        saving.value = false
        submitting.value = false
        loading.value = false
        lastLoadedId.value = ''
        lastSavedAt.value = ''
    }

    async function prefetchArticleDetail(articleId: number | string, force = false) {
        const nextId = String(articleId)
        const cached = getCachedArticleDetail(nextId)

        if (!force && cached) {
            return cached
        }

        const response = await articleApi.getArticleDetail(articleId)
        const vm = mapArticleDetailDtoToVm(response)

        cacheArticleDetail(vm, response.updatedAt ?? '')

        return vm
    }

    async function loadArticleDetail(articleId: number | string, force = false) {
        const nextId = String(articleId)
        const cached = getCachedArticleDetail(nextId)

        if (!force && cached) {
            setCurrentArticle(cached)
            lastLoadedId.value = nextId
            setLastSavedAt(getCachedArticleSavedAt(nextId))
            return cached
        }

        loading.value = true

        try {
            const response = await articleApi.getArticleDetail(articleId)
            const vm = mapArticleDetailDtoToVm(response)

            setCurrentArticle(vm, response.updatedAt ?? '')
            lastLoadedId.value = nextId
            setLastSavedAt(response.updatedAt ?? '')

            return vm
        } finally {
            loading.value = false
        }
    }

    return {
        currentArticle,
        articleDetails,
        articleDetailSavedAt,
        intentionallyEmptySummaryArticleIds,
        dirty,
        manualSavePending,
        changeRevision,
        markChanged,
        acknowledgeManualSave,
        beginEditorSession,
        recordDraftSave,
        getDraftSaveReceipt,
        saving,
        submitting,
        loading,
        lastLoadedId,
        lastSavedAt,

        currentStatus,
        canSubmit,
        canCancel,

        setCurrentArticle,
        cacheArticleDetail,
        patchCachedArticleDetail,
        getCachedArticleDetail,
        setSummaryIntentionallyEmpty,
        isSummaryIntentionallyEmpty,
        setDirty,
        setSaving,
        setSubmitting,
        setLastSavedAt,
        resetEditorState,
        prefetchArticleDetail,
        loadArticleDetail,
    }
})
