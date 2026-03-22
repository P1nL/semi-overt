import {
    ARTICLE_DEFAULT_TITLE,
    ARTICLE_DURATION_CATEGORY,
    ARTICLE_DURATION_LABEL_MAP,
    ARTICLE_STATUS,
    ARTICLE_STATUS_LABEL_MAP,
    ARTICLE_WORDS_PER_MINUTE,
    type ArticleDurationCategory,
    type ArticleStatus,
} from '@/shared/constants/article'

export function getArticleStatusLabel(status?: string | null): string {
    if (!status) return '未知状态'
    return ARTICLE_STATUS_LABEL_MAP[status as ArticleStatus] ?? status
}

export function getArticleDurationLabel(category?: string | null): string {
    if (!category) return '未分类'
    return ARTICLE_DURATION_LABEL_MAP[category as ArticleDurationCategory] ?? category
}

export function getArticleDisplayTitle(title?: string | null): string {
    return title?.trim() || ARTICLE_DEFAULT_TITLE
}

export function calcWordCount(content?: string | null): number {
    if (!content) return 0

    const plainText = content
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/<\/?(?:img|hr)[^>]*>/gi, ' ')
        .replace(/<\/?(?:p|div|section|article|blockquote|pre|code|ul|ol|li|h[1-6]|mark)[^>]*>/gi, ' ')
        .replace(/```/g, ' ')
        .replace(/`/g, '')
        .replace(/^[\t ]{0,3}(#{1,6}|\>|\-|\+|\*|\d+\.)[\t ]+/gm, '')
        .replace(/[*_~]/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim()

    if (!plainText) return 0

    return Array.from(plainText.replace(/\s+/g, '')).length
}

export function calcReadMinutes(wordCount: number): number {
    if (wordCount <= 0) return 0
    return Number((wordCount / ARTICLE_WORDS_PER_MINUTE).toFixed(1))
}

export function resolveDurationCategory(wordCount: number): ArticleDurationCategory {
    const readMinutes = calcReadMinutes(wordCount)

    if (readMinutes <= 3) return ARTICLE_DURATION_CATEGORY.QUICK
    if (readMinutes <= 8) return ARTICLE_DURATION_CATEGORY.SHORT
    return ARTICLE_DURATION_CATEGORY.DEEP
}

export function canEditArticle(status?: string | null): boolean {
    return status === ARTICLE_STATUS.DRAFT || status === ARTICLE_STATUS.RETURNED
}

export function canSubmitArticle(status?: string | null): boolean {
    return canEditArticle(status)
}

export function canCancelReview(status?: string | null): boolean {
    return status === ARTICLE_STATUS.PENDING
}

export function isPublishedArticle(status?: string | null): boolean {
    return status === ARTICLE_STATUS.APPROVED
}
