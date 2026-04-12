import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { mapArticleDetailDtoToVm } from '@/entities/article'
import type { ArticleDetailVm } from '@/entities/article'
import { articleApi } from '@/shared/api/modules/article'
import { canCancelReview, canSubmitArticle } from '@/shared/utils/article'

export const useEditorStore = defineStore('editor', () => {
    const currentArticle = ref<ArticleDetailVm | null>(null)
    const intentionallyEmptySummaryArticleIds = ref<Record<string, true>>({})
    const dirty = ref(false)
    const saving = ref(false)
    const submitting = ref(false)
    const loading = ref(false)
    const lastLoadedId = ref<string>('')
    const lastSavedAt = ref<string>('')

    const currentStatus = computed(() => currentArticle.value?.status.value ?? '')
    const canSubmit = computed(() => canSubmitArticle(currentStatus.value))
    const canCancel = computed(() => canCancelReview(currentStatus.value))

    function setCurrentArticle(article: ArticleDetailVm | null) {
        currentArticle.value = article
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
        currentArticle.value = null
        dirty.value = false
        saving.value = false
        submitting.value = false
        loading.value = false
        lastLoadedId.value = ''
        lastSavedAt.value = ''
    }

    async function loadArticleDetail(articleId: number | string, force = false) {
        const nextId = String(articleId)
        if (!force && nextId === lastLoadedId.value && currentArticle.value) {
            return currentArticle.value
        }

        loading.value = true

        try {
            const response = await articleApi.getArticleDetail(articleId)
            const vm = mapArticleDetailDtoToVm(response)

            currentArticle.value = vm
            lastLoadedId.value = nextId
            setLastSavedAt(response.updatedAt ?? '')

            return vm
        } finally {
            loading.value = false
        }
    }

    return {
        currentArticle,
        intentionallyEmptySummaryArticleIds,
        dirty,
        saving,
        submitting,
        loading,
        lastLoadedId,
        lastSavedAt,

        currentStatus,
        canSubmit,
        canCancel,

        setCurrentArticle,
        setSummaryIntentionallyEmpty,
        isSummaryIntentionallyEmpty,
        setDirty,
        setSaving,
        setSubmitting,
        setLastSavedAt,
        resetEditorState,
        loadArticleDetail,
    }
})
