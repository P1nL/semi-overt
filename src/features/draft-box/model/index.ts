import {
  mapArticleCardDtoToVm,
  mapArticleDraftDtoToVm,
} from '@/entities/article/model/article.mapper'
import type {
  ArticleCardEntityDto,
  ArticleCardVm,
} from '@/entities/article/model/article.types'
import { articleApi } from '@/shared/api/modules/article'
import { userApi } from '@/shared/api/modules/user'
import { getErrorMessage } from '@/shared/utils/error'
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

function mapDraftItemToDraftBoxItem(item: DraftItemRespDto): DraftBoxItem {
  const vm = mapArticleDraftDtoToVm(item)

  return {
    ...vm,
    sortAtRaw: item.updatedAt,
    canDelete: true,
  }
}

function mapPendingItemToDraftBoxItem(item: ArticleCardEntityDto): DraftBoxItem {
  const vm: ArticleCardVm = mapArticleCardDtoToVm(item)
  const sortAtRaw = item.updatedAt ?? item.publishedAt ?? ''

  return {
    id: vm.id,
    title: vm.title,
    status: vm.status!,
    wordCount: vm.meta.wordCount ?? 0,
    wordCountText: vm.meta.wordCountText ?? '0 字',
    updatedAt: vm.meta.updatedAt ?? vm.meta.publishedAt ?? '',
    latestReason: vm.latestReason,
    editPath: vm.editPath,
    sortAtRaw,
    canDelete: false,
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

export async function loadDraftBoxItems(username: string): Promise<DraftBoxLoadResult> {
  const [draftList, pendingResult] = await Promise.all([
    articleApi.getDraftList(),
    userApi
      .getUserProfile(username, { tab: 'pending', page: 1, pageSize: 20 })
      .then((response) => ({
        items: response.list as ArticleCardEntityDto[],
        warning: '',
      }))
      .catch((error: unknown) => ({
        items: [] as ArticleCardEntityDto[],
        warning: getErrorMessage(error, '审核中列表加载失败'),
      })),
  ])

  const items = [
    ...draftList.map(mapDraftItemToDraftBoxItem),
    ...pendingResult.items
      .filter((item) => item.status?.toUpperCase?.() === 'PENDING')
      .map(mapPendingItemToDraftBoxItem),
  ].sort((left, right) => toSortTimestamp(right.sortAtRaw) - toSortTimestamp(left.sortAtRaw))

  return {
    items,
    badgeCount: items.length,
    pendingWarning: pendingResult.warning,
  }
}

export function syncDraftStore(store: DraftStoreLike, drafts: DraftBoxItem[]) {
  store.badgeCount = drafts.length
  store.items = drafts.map((item) =>
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
