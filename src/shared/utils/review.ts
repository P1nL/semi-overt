import { REVIEW_ACTION } from '@/shared/constants/review'

export function requiresReviewReason(action?: string | null): boolean {
    return action === REVIEW_ACTION.RETURN || action === REVIEW_ACTION.REJECT
}
