import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import {
    ARTICLE_STATUS,
    ARTICLE_STATUS_BADGE_VARIANT_MAP,
    ARTICLE_STATUS_LABEL_MAP,
    type ArticleStatus,
} from '@/entities/article/model/article.constants'
import type { ArticleCardEntityDto, ArticleCardVm, ArticleStatusVm } from '@/entities/article/model/article.types'
import { articleApi } from '@/shared/api/modules/article'
import type { DraftItemRespDto } from '@/shared/types/api'
import { calcReadMinutes, resolveDurationCategory } from '@/shared/utils/article'

const DRAFT_STATUS_PRIORITY: Record<string, number> = {
    [ARTICLE_STATUS.DRAFT]: 1,
    [ARTICLE_STATUS.REJECTED]: 2,
    [ARTICLE_STATUS.RETURNED]: 3,
    [ARTICLE_STATUS.PENDING]: 4,
}

function toSortTimestamp(value?: string | null): number {
    if (!value) return 0

    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
}

function toDisplayDate(value?: string | null): string | null {
    if (!value) return null

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}

function getDraftStatusPriority(status?: string | null): number {
    return DRAFT_STATUS_PRIORITY[status?.toUpperCase?.() ?? ''] ?? 0
}

function getDraftCardTimestamp(item: ArticleCardVm): number {
    return toSortTimestamp(item.meta.updatedAt || item.meta.displayTime)
}

function getDraftCardStatusPriority(item: ArticleCardVm): number {
    return getDraftStatusPriority(item.status?.value)
}

function shouldUseNextDraftCard(current: ArticleCardVm, next: ArticleCardVm): boolean {
    const currentSortAt = getDraftCardTimestamp(current)
    const nextSortAt = getDraftCardTimestamp(next)

    if (nextSortAt !== currentSortAt) {
        return nextSortAt > currentSortAt
    }

    return getDraftCardStatusPriority(next) > getDraftCardStatusPriority(current)
}

function dedupeDraftCards(nextItems: ArticleCardVm[]): ArticleCardVm[] {
    const itemById = new Map<number, ArticleCardVm>()

    for (const item of nextItems) {
        const current = itemById.get(item.id)
        if (!current || shouldUseNextDraftCard(current, item)) {
            itemById.set(item.id, item)
        }
    }

    return Array.from(itemById.values()).sort(
        (left, right) => getDraftCardTimestamp(right) - getDraftCardTimestamp(left),
    )
}

function shouldUseNextDraftDto(current: DraftItemRespDto, next: DraftItemRespDto): boolean {
    const currentSortAt = toSortTimestamp(current.updatedAt)
    const nextSortAt = toSortTimestamp(next.updatedAt)

    if (nextSortAt !== currentSortAt) {
        return nextSortAt > currentSortAt
    }

    return getDraftStatusPriority(next.status) > getDraftStatusPriority(current.status)
}

function dedupeDraftDtos(drafts: DraftItemRespDto[]): DraftItemRespDto[] {
    const draftById = new Map<number, DraftItemRespDto>()

    for (const draft of drafts) {
        const current = draftById.get(draft.id)
        if (!current || shouldUseNextDraftDto(current, draft)) {
            draftById.set(draft.id, draft)
        }
    }

    return Array.from(draftById.values()).sort(
        (left, right) => toSortTimestamp(right.updatedAt) - toSortTimestamp(left.updatedAt),
    )
}

function isArticleStatus(status: string): status is ArticleStatus {
    return status in ARTICLE_STATUS_LABEL_MAP
}

function createDraftStatusVm(status: string): ArticleStatusVm {
    const normalizedStatus = status.toUpperCase()
    const articleStatus = isArticleStatus(normalizedStatus) ? normalizedStatus : ARTICLE_STATUS.DRAFT

    return {
        value: articleStatus,
        label: ARTICLE_STATUS_LABEL_MAP[articleStatus],
        variant: ARTICLE_STATUS_BADGE_VARIANT_MAP[articleStatus],
    }
}

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
        const dedupedItems = dedupeDraftCards(nextItems)
        items.value = dedupedItems
        badgeCount.value = dedupedItems.length
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
            const nextItems = dedupeDraftDtos(response).map((item) =>
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

    function updateStatusById(articleId: number | string, status: string, updatedAt?: string | null): boolean {
        let matched = false
        const displayDate = toDisplayDate(updatedAt) ?? null

        const nextItems = items.value.map((item) => {
            if (String(item.id) !== String(articleId)) return item

            matched = true
            const nextUpdatedAt = displayDate ?? item.meta.updatedAt

            return {
                ...item,
                status: createDraftStatusVm(status),
                meta: {
                    ...item.meta,
                    updatedAt: nextUpdatedAt,
                    displayTime: nextUpdatedAt ?? item.meta.displayTime,
                },
            }
        })

        if (!matched) {
            reset()
            return false
        }

        setItems(nextItems)
        return true
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
        updateStatusById,
    }
})
