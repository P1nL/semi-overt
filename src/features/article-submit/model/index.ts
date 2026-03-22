import { articleApi } from '@/shared/api/modules/article'
import { canSubmitArticle } from '@/shared/utils/article'
import type { SubmitArticleRespDto } from '@/shared/types/api'

export interface ArticleSubmitResult extends SubmitArticleRespDto {}

export function canSubmitArticleStatus(status?: string | null): boolean {
    return canSubmitArticle(status)
}

export async function submitArticleById(articleId: number | string): Promise<ArticleSubmitResult> {
    return articleApi.submitArticle(articleId)
}

