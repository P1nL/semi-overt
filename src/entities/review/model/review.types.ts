// src/entities/review/model/review.types.ts
import type { PendingReviewItemDto, ReviewActionRespDto, ReviewLogRespDto } from '@/shared/types/api'
import type { ReviewAction } from './review.constants'
import type { ArticleAuthorVm, ArticleStatusVm } from '@/entities/article/model/article.types'

export interface PendingReviewItemEntityDto extends PendingReviewItemDto {}

export interface ReviewLogEntityDto extends ReviewLogRespDto {}

export interface ReviewActionResultEntityDto extends ReviewActionRespDto {}

export interface PendingReviewItemVm {
    id: number
    title: string
    submitCount: number
    submitCountText: string
    submittedAt: string
    wordCount: number
    wordCountText: string
    author: ArticleAuthorVm | null
    reviewPath: string
    articlePath: string
}

export interface ReviewActionVm {
    value: ReviewAction | string
    label: string
    variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

export interface ReviewLogVm {
    id: string
    action: ReviewActionVm
    fromStatus: ArticleStatusVm
    toStatus: ArticleStatusVm
    reason: string | null
    operator: ArticleAuthorVm | null
    createdAt: string
    description: string
}