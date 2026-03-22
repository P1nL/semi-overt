import {
    REVIEW_ACTION,
    REVIEW_ACTION_LABEL_MAP,
    REVIEW_ACTION_RESULT_STATUS_MAP,
    type ReviewAction,
} from '@/shared/constants/review'
import { getArticleStatusLabel } from './article'

export function getReviewActionLabel(action?: string | null): string {
    if (!action) return '未知操作'
    return REVIEW_ACTION_LABEL_MAP[action as ReviewAction] ?? action
}

export function getReviewResultStatus(action?: string | null): string | undefined {
    if (!action) return undefined
    return REVIEW_ACTION_RESULT_STATUS_MAP[action as ReviewAction]
}

export function requiresReviewReason(action?: string | null): boolean {
    return action === REVIEW_ACTION.RETURN || action === REVIEW_ACTION.REJECT
}

export function getReviewTransitionLabel(
    fromStatus?: string | null,
    toStatus?: string | null,
): string {
    const fromLabel = getArticleStatusLabel(fromStatus)
    const toLabel = getArticleStatusLabel(toStatus)

    return `${fromLabel} → ${toLabel}`
}