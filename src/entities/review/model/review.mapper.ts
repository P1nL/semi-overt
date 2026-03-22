// src/entities/review/model/review.mapper.ts
import { mapArticleAuthorDtoToVm } from '@/entities/article/model/article.mapper'
import type { ArticleStatusVm } from '@/entities/article/model/article.types'
import { ARTICLE_STATUS_BADGE_VARIANT_MAP, ARTICLE_STATUS_LABEL_MAP } from '@/entities/article/model/article.constants'
import type {
    PendingReviewItemEntityDto,
    PendingReviewItemVm,
    ReviewActionVm,
    ReviewLogEntityDto,
    ReviewLogVm,
} from './review.types'
import { REVIEW_ACTION_BADGE_VARIANT_MAP, REVIEW_ACTION_LABEL_MAP } from './review.constants'

function toDisplayDate(value?: string | null): string {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function formatStatus(status?: string | null): ArticleStatusVm {
    const normalized = status?.toUpperCase() || 'DRAFT'
    const typed = normalized in ARTICLE_STATUS_LABEL_MAP ? (normalized as keyof typeof ARTICLE_STATUS_LABEL_MAP) : undefined

    return {
        value: normalized,
        label: typed ? ARTICLE_STATUS_LABEL_MAP[typed] : normalized,
        variant: typed ? ARTICLE_STATUS_BADGE_VARIANT_MAP[typed] : 'default',
    }
}

function formatAction(action?: string | null): ReviewActionVm {
    const normalized = action?.toUpperCase() || 'CANCEL'
    const typed = normalized in REVIEW_ACTION_LABEL_MAP ? (normalized as keyof typeof REVIEW_ACTION_LABEL_MAP) : undefined

    return {
        value: normalized,
        label: typed ? REVIEW_ACTION_LABEL_MAP[typed] : normalized,
        variant: typed ? REVIEW_ACTION_BADGE_VARIANT_MAP[typed] : 'default',
    }
}

export function mapPendingReviewItemDtoToVm(dto: PendingReviewItemEntityDto): PendingReviewItemVm {
    return {
        id: dto.id,
        title: dto.title || '未命名文章',
        submitCount: dto.submitCount,
        submitCountText: `第 ${dto.submitCount} 次提交`,
        submittedAt: toDisplayDate(dto.submittedAt),
        wordCount: dto.wordCount,
        wordCountText: `${dto.wordCount} 字`,
        author: mapArticleAuthorDtoToVm(dto.author),
        reviewPath: `/review/articles/${dto.id}`,
        articlePath: `/articles/${dto.id}`,
    }
}

export function mapReviewLogDtoToVm(dto: ReviewLogEntityDto, index: number): ReviewLogVm {
    const action = formatAction(dto.action)
    const fromStatus = formatStatus(dto.fromStatus)
    const toStatus = formatStatus(dto.toStatus)
    const operator = mapArticleAuthorDtoToVm(dto.operator)

    return {
        id: `${dto.createdAt}-${index}-${dto.action}`,
        action,
        fromStatus,
        toStatus,
        reason: dto.reason ?? null,
        operator,
        createdAt: toDisplayDate(dto.createdAt),
        description: `${action.label}：${fromStatus.label} → ${toStatus.label}`,
    }
}

export function mapReviewLogListDtoToVm(list: ReviewLogEntityDto[] = []): ReviewLogVm[] {
    return list.map((item, index) => mapReviewLogDtoToVm(item, index))
}