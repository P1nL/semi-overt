import { articleApi } from '@/shared/api/modules/article'
import { canCancelReview } from '@/shared/utils/article'
import type { CancelReviewRespDto } from '@/shared/types/api'

export interface ArticleCancelReviewResult extends CancelReviewRespDto {}

export function canCancelReviewStatus(status?: string | null): boolean {
    return canCancelReview(status)
}

export async function cancelReviewByArticleId(articleId: number | string): Promise<ArticleCancelReviewResult> {
    return articleApi.cancelReview(articleId)
}

