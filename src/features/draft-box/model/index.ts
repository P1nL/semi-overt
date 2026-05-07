import {
  mapArticleDraftDtoToVm,
  mapArticleCardDtoToVm,
} from '@/entities/article/model/article.mapper'
import type { ArticleCardEntityDto } from '@/entities/article/model/article.types'
import { ARTICLE_STATUS } from '@/shared/constants/article'
import { articleApi } from '@/shared/api/modules/article'
import { calcReadMinutes, resolveDurationCategory } from '@/shared/utils/article'
import type { DraftItemRespDto } from '@/shared/types/api'
import type {
  DraftBoxItem,
  DraftBoxLoadResult,
  DraftStoreLike,
} from './draft-box.types'

function toSortTimestamp(value?: string | null): number {
  if (!value) return 0

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

const DRAFT_STATUS_PRIORITY: Record<string, number> = {
  [ARTICLE_STATUS.DRAFT]: 1,
  [ARTICLE_STATUS.REJECTED]: 2,
  [ARTICLE_STATUS.RETURNED]: 3,
  [ARTICLE_STATUS.PENDING]: 4,
}

function getDraftStatusPriority(status?: string | null): number {
  return DRAFT_STATUS_PRIORITY[status?.toUpperCase?.() ?? ''] ?? 0
}

function shouldUseNextDraftItem(current: DraftBoxItem, next: DraftBoxItem): boolean {
  const currentSortAt = toSortTimestamp(current.sortAtRaw || current.updatedAt)
  const nextSortAt = toSortTimestamp(next.sortAtRaw || next.updatedAt)

  if (nextSortAt !== currentSortAt) {
    return nextSortAt > currentSortAt
  }

  return getDraftStatusPriority(next.status.value) > getDraftStatusPriority(current.status.value)
}

function dedupeDraftBoxItems(items: DraftBoxItem[]): DraftBoxItem[] {
  const itemById = new Map<number, DraftBoxItem>()

  for (const item of items) {
    const current = itemById.get(item.id)
    if (!current || shouldUseNextDraftItem(current, item)) {
      itemById.set(item.id, item)
    }
  }

  return Array.from(itemById.values()).sort(
    (left, right) =>
      toSortTimestamp(right.sortAtRaw || right.updatedAt) - toSortTimestamp(left.sortAtRaw || left.updatedAt),
  )
}

function mapDraftItemToDraftBoxItem(item: DraftItemRespDto): DraftBoxItem {
  const vm = mapArticleDraftDtoToVm(item)

  return {
    ...vm,
    sortAtRaw: item.updatedAt,
    canDelete: item.status?.toUpperCase?.() !== ARTICLE_STATUS.PENDING,
  }
}

function mapDraftDtoToCardDto(dto: {
  id: number
  title: string
  status: string
  wordCount: number
  updatedAt: string
  latestReason: string | null
}): ArticleCardEntityDto {
  return {
    id: dto.id,
    title: dto.title,
    summary: dto.latestReason,
    coverUrl: null,
    coverColor: null,
    readMinutes: calcReadMinutes(dto.wordCount),
    durationCategory: resolveDurationCategory(dto.wordCount),
    wordCount: dto.wordCount,
    status: dto.status,
    updatedAt: dto.updatedAt,
    rejectReason: dto.latestReason,
  }
}

export async function loadDraftBoxItems(_username: string): Promise<DraftBoxLoadResult> {
  const draftList = await articleApi.getDraftList()

  const items = dedupeDraftBoxItems(draftList.map(mapDraftItemToDraftBoxItem))

  return {
    items,
    badgeCount: items.length,
    pendingWarning: '',
  }
}

export function syncDraftStore(store: DraftStoreLike, drafts: DraftBoxItem[]) {
  const dedupedDrafts = dedupeDraftBoxItems(drafts)

  store.badgeCount = dedupedDrafts.length
  store.items = dedupedDrafts.map((item) =>
    mapArticleCardDtoToVm(
      mapDraftDtoToCardDto({
        id: item.id,
        title: item.title,
        status: item.status.value,
        wordCount: item.wordCount,
        updatedAt: item.sortAtRaw || item.updatedAt,
        latestReason: item.latestReason,
      }),
    ),
  )
}

export async function deleteDraftById(articleId: number | string) {
  await articleApi.deleteArticle(articleId)
}

export type { DraftBoxItem, DraftBoxLoadResult, DraftStoreLike }
