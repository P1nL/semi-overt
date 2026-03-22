export const ARTICLE_STATUS = {
    DRAFT: 'DRAFT',
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    RETURNED: 'RETURNED',
    REJECTED: 'REJECTED',
} as const

export type ArticleStatus = (typeof ARTICLE_STATUS)[keyof typeof ARTICLE_STATUS]

export const ARTICLE_STATUS_ORDER: readonly ArticleStatus[] = [
    ARTICLE_STATUS.DRAFT,
    ARTICLE_STATUS.PENDING,
    ARTICLE_STATUS.APPROVED,
    ARTICLE_STATUS.RETURNED,
    ARTICLE_STATUS.REJECTED,
]

export const ARTICLE_STATUS_LABEL_MAP: Record<ArticleStatus, string> = {
    DRAFT: '草稿',
    PENDING: '待审核',
    APPROVED: '已通过',
    RETURNED: '已退回',
    REJECTED: '已拒绝',
}

export const ARTICLE_DURATION_CATEGORY = {
    QUICK: 'QUICK',
    SHORT: 'SHORT',
    DEEP: 'DEEP',
} as const

export type ArticleDurationCategory =
    (typeof ARTICLE_DURATION_CATEGORY)[keyof typeof ARTICLE_DURATION_CATEGORY]

export const ARTICLE_DURATION_LABEL_MAP: Record<ArticleDurationCategory, string> = {
    QUICK: '速读',
    SHORT: '短读',
    DEEP: '深读',
}

export const ARTICLE_DEFAULT_TITLE = '未命名草稿'

export const ARTICLE_SUMMARY_MAX_LENGTH = 255
export const ARTICLE_TITLE_MAX_LENGTH = 120
export const ARTICLE_WORDS_PER_MINUTE = 300

export const ARTICLE_SUBMIT_COOLDOWN_MINUTES = 30

export const ARTICLE_IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ARTICLE_IMAGE_ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const
export const ARTICLE_IMAGE_MAX_SIZE_MB = 5
