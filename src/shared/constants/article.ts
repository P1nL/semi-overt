// src/shared/constants/article.ts
// 业务域常量统一由 entities/article 层维护，此处 re-export 保持向后兼容
export {
    ARTICLE_STATUS,
    ARTICLE_DURATION_CATEGORY,
    ARTICLE_STATUS_LABEL_MAP,
    ARTICLE_DURATION_LABEL_MAP,
    ARTICLE_DEFAULT_TITLE,
    ARTICLE_WORDS_PER_MINUTE,
} from '@/entities/article'

export type {
    ArticleStatus,
    ArticleDurationCategory,
} from '@/entities/article'

// 以下为 shared 层独有的约束配置，不属于业务域常量
export const ARTICLE_SUMMARY_MAX_LENGTH = 255
export const ARTICLE_TITLE_MAX_LENGTH = 120

export const ARTICLE_IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ARTICLE_IMAGE_ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const
export const ARTICLE_IMAGE_MAX_SIZE_MB = 5
