import {
    ARTICLE_DURATION_CATEGORY,
    ARTICLE_STATUS,
    ARTICLE_WORDS_PER_MINUTE,
    type ArticleDurationCategory,
} from '@/shared/constants/article'

export function calcWordCount(content?: string | null): number {
    if (!content) return 0

    const plainText = toPlainArticleText(content)

    if (!plainText) return 0

    return Array.from(plainText.replace(/\s+/g, '')).length
}

export function toPlainArticleText(content?: string | null): string {
    if (!content) return ''

    return content
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
        .replace(/^[\t ]{0,3}(?:`{3,}|~{3,})[^\r\n]*(?:\r?\n|$)/gm, ' ')
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/<\/?(?:img|hr)[^>]*>/gi, ' ')
        .replace(/<\/?(?:p|div|section|article|blockquote|pre|code|ul|ol|li|h[1-6]|mark)[^>]*>/gi, ' ')
        .replace(/```/g, ' ')
        .replace(/`/g, '')
        .replace(/^[\t ]{0,3}(#{1,6}|\>|\-|\+|\*|\d+\.)[\t ]+/gm, '')
        .replace(/[*_~]/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
            const named: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }
            const normalized = entity.toLowerCase()
            if (normalized in named) return named[normalized]!
            const code = normalized.startsWith('&#x') ? parseInt(normalized.slice(3), 16) : parseInt(normalized.slice(2), 10)
            return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity
        })
        .replace(/\s+/g, ' ')
        .trim()
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
