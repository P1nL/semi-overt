import type {
    ArticleAuthorDto,
    ArticleCardDto,
    ArticleDetailRespDto,
    DraftItemRespDto,
} from '@/shared/types/api'
import type { ArticleDurationCategory, ArticleStatus } from './article.constants'

export interface ArticleAuthorEntityDto extends ArticleAuthorDto {
    avatarUrl?: string | null
}

export interface ArticleCardEntityDto extends ArticleCardDto {
    status?: ArticleStatus | string
    durationCategory?: ArticleDurationCategory | string
    rejectReason?: string | null
}

export interface ArticleDetailEntityDto extends ArticleDetailRespDto {
    status: ArticleStatus | string
    durationCategory: ArticleDurationCategory | string
}

export interface ArticleDraftEntityDto extends DraftItemRespDto {
    status: Extract<ArticleStatus, 'DRAFT' | 'RETURNED'> | string
}

export interface ArticleAuthorVm {
    id: number
    username: string
    displayName: string
    avatarUrl: string | null
    initials: string
    profilePath: string
}

export interface ArticleMetaVm {
    readMinutes: number
    readMinutesText: string
    durationCategory: string
    durationLabel: string
    wordCount: number | null
    wordCountText: string | null
    publishedAt: string | null
    updatedAt: string | null
    displayTime: string | null
}

export interface ArticleStatusVm {
    value: ArticleStatus | string
    label: string
    variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

export interface ArticleCoverVm {
    src: string | null
    alt: string
    color: string
    rawColor: string | null
    hasImage: boolean
}

export interface ArticleSummaryVm {
    text: string
    rawText: string | null
    isFallback: boolean
}

export interface ArticleCardVm {
    id: number
    title: string
    titleText: string
    summary: ArticleSummaryVm
    cover: ArticleCoverVm
    meta: ArticleMetaVm
    status: ArticleStatusVm | null
    author: ArticleAuthorVm | null
    latestReason: string | null
    articlePath: string
    editPath: string
    reviewPath: string
}

export interface ArticleDetailVm {
    id: number
    title: string
    rawTitle: string | null
    content: string
    summary: ArticleSummaryVm
    cover: ArticleCoverVm
    meta: ArticleMetaVm
    status: ArticleStatusVm
    author: ArticleAuthorVm
    latestReviewReason: string | null
    submitCount: number
    submitCountText: string
    lastSubmittedAt: string | null
    lastSubmittedAtRaw: string | null
    articlePath: string
    editPath: string
    reviewPath: string
}

export interface ArticleDraftVm {
    id: number
    title: string
    status: ArticleStatusVm
    wordCount: number
    wordCountText: string
    updatedAt: string
    latestReason: string | null
    editPath: string
}
