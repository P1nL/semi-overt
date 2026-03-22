import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import type { ArticleCardEntityDto, ArticleCardVm } from '@/entities/article/model/article.types'
import { articleApi } from '@/shared/api/modules/article'
import { calcReadMinutes, resolveDurationCategory } from '@/shared/utils/article'

function toDraftCardDto(input: {
    id: number
    title: string | null
    status: string
    wordCount: number
    updatedAt: string
    latestReason: string | null
}): ArticleCardEntityDto {
    return {
        id: input.id,
        title: input.title,
        summary: input.latestReason,
        coverUrl: null,
        coverColor: null,
        readMinutes: calcReadMinutes(input.wordCount),
        durationCategory: resolveDurationCategory(input.wordCount),
        wordCount: input.wordCount,
        status: input.status,
        updatedAt: input.updatedAt,
        rejectReason: input.latestReason,
    }
}

export const useDraftStore = defineStore('draft', () => {
    const items = ref<ArticleCardVm[]>([])
    const badgeCount = ref(0)
    const loading = ref(false)
    const initialized = ref(false)
    const lastLoadedAt = ref('')

    const hasDrafts = computed(() => items.value.length > 0)

    function setItems(nextItems: ArticleCardVm[]) {
        items.value = nextItems
        badgeCount.value = nextItems.length
        initialized.value = true
    }

    function removeById(articleId: number | string) {
        items.value = items.value.filter((item) => String(item.id) !== String(articleId))
        badgeCount.value = items.value.length
    }

    function reset() {
        items.value = []
        badgeCount.value = 0
        loading.value = false
        initialized.value = false
        lastLoadedAt.value = ''
    }

    async function loadDrafts(force = false) {
        if (loading.value) return
        if (initialized.value && !force) return

        loading.value = true

        try {
            const response = await articleApi.getDraftList()
            const nextItems = response.map((item) =>
                mapArticleCardDtoToVm(
                    toDraftCardDto({
                        id: item.id,
                        title: item.title,
                        status: item.status,
                        wordCount: item.wordCount,
                        updatedAt: item.updatedAt,
                        latestReason: item.latestReason,
                    }),
                ),
            )
            setItems(nextItems)
            lastLoadedAt.value = new Date().toISOString()
        } finally {
            loading.value = false
        }
    }

    return {
        items,
        badgeCount,
        loading,
        initialized,
        lastLoadedAt,

        hasDrafts,

        setItems,
        removeById,
        reset,
        loadDrafts,
    }
})
