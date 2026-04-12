import { ARTICLE_STATUS } from '@/shared/constants/article'
import { REVIEW_REASON_MAX_LENGTH } from '@/shared/constants/review'
import { reviewApi } from '@/shared/api/modules/review'
import { requiresReviewReason } from '@/shared/utils/review'
import type {
    ReviewActionFormValues,
    ReviewActionResult,
    ReviewActionValue,
    ReviewActionValidationResult,
} from './review-action.types'

export function canReviewArticle(status?: string | null): boolean {
    return status?.toUpperCase() === ARTICLE_STATUS.PENDING
}

export function createReviewActionFormValues(action: ReviewActionValue): ReviewActionFormValues {
    return {
        action,
        reason: '',
    }
}

export function validateReviewActionForm(values: ReviewActionFormValues): ReviewActionValidationResult {
    const errors: ReviewActionValidationResult['errors'] = {}

    if (requiresReviewReason(values.action) && !values.reason.trim()) {
        errors.reason = '请填写处理原因'
    } else if (values.reason.length > REVIEW_REASON_MAX_LENGTH) {
        errors.reason = `原因最多 ${REVIEW_REASON_MAX_LENGTH} 字`
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    }
}

export async function submitReviewActionByArticleId(
    articleId: number | string,
    values: ReviewActionFormValues,
): Promise<ReviewActionResult> {
    return reviewApi.submitReviewAction(articleId, {
        action: values.action,
        reason: values.reason.trim() || undefined,
    })
}

export type {
    ReviewActionFieldErrors,
    ReviewActionFormValues,
    ReviewActionResult,
    ReviewActionValue,
    ReviewActionValidationResult,
} from './review-action.types'
