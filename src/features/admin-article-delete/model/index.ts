import { articleApi } from '@/shared/api/modules/article'

export interface AdminArticleDeleteResult {
    ok: boolean
}

export async function adminDeleteArticleById(
    articleId: number | string,
): Promise<AdminArticleDeleteResult> {
    const result = await articleApi.adminDeleteArticle(articleId)
    return {
        ok: result?.ok ?? true,
    }
}
