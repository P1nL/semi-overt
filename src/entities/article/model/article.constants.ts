// src/entities/article/model/article.constants.ts
export const ARTICLE_STATUS = {
    DRAFT: 'DRAFT',
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    RETURNED: 'RETURNED',
    REJECTED: 'REJECTED',
} as const

export type ArticleStatus = (typeof ARTICLE_STATUS)[keyof typeof ARTICLE_STATUS]

export const ARTICLE_DURATION_CATEGORY = {
    QUICK: 'QUICK',
    SHORT: 'SHORT',
    DEEP: 'DEEP',
} as const

export type ArticleDurationCategory =
    (typeof ARTICLE_DURATION_CATEGORY)[keyof typeof ARTICLE_DURATION_CATEGORY]

export const ARTICLE_STATUS_LABEL_MAP: Record<ArticleStatus, string> = {
    DRAFT: '草稿',
    PENDING: '审核中',
    APPROVED: '已发布',
    RETURNED: '已退回',
    REJECTED: '已拒绝',
}

export const ARTICLE_DURATION_LABEL_MAP: Record<ArticleDurationCategory, string> = {
    QUICK: '速读',
    SHORT: '短读',
    DEEP: '深读',
}

export const ARTICLE_STATUS_BADGE_VARIANT_MAP: Record<
    ArticleStatus,
    'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
> = {
    DRAFT: 'default',
    PENDING: 'warning',
    APPROVED: 'success',
    RETURNED: 'info',
    REJECTED: 'danger',
}

export const ARTICLE_DEFAULT_COVER_COLOR = '#F3F4F6'
export const ARTICLE_DEFAULT_TITLE = '未命名文章'
export const ARTICLE_DEFAULT_AUTHOR_NAME = '未知作者'

export const ARTICLE_WORDS_PER_MINUTE = 300
