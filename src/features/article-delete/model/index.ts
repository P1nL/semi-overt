import { articleApi } from '@/shared/api/modules/article'
import { ARTICLE_STATUS } from '@/shared/constants/article'

const DELETABLE_STATUS = new Set<string>([
    ARTICLE_STATUS.DRAFT,
    ARTICLE_STATUS.RETURNED,
    ARTICLE_STATUS.REJECTED,
])

export interface ArticleDeleteResult {
    ok: boolean
}

export function canDeleteArticleStatus(status?: string | null): boolean {
    if (!status) return false
    return DELETABLE_STATUS.has(status.toUpperCase())
}

export async function deleteArticleById(articleId: number | string): Promise<ArticleDeleteResult> {
    await articleApi.deleteArticle(articleId)
    return { ok: true }
}

