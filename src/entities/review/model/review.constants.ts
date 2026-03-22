// src/entities/review/model/review.constants.ts
export const REVIEW_ACTION = {
    APPROVE: 'APPROVE',
    RETURN: 'RETURN',
    REJECT: 'REJECT',
    CANCEL: 'CANCEL',
} as const

export type ReviewAction = (typeof REVIEW_ACTION)[keyof typeof REVIEW_ACTION]

export const REVIEW_ACTION_LABEL_MAP: Record<ReviewAction, string> = {
    APPROVE: '通过',
    RETURN: '退回',
    REJECT: '拒绝',
    CANCEL: '取消审核',
}

export const REVIEW_ACTION_BADGE_VARIANT_MAP: Record<
    ReviewAction,
    'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
> = {
    APPROVE: 'success',
    RETURN: 'warning',
    REJECT: 'danger',
    CANCEL: 'info',
}

export const REVIEW_ACTION_REASON_REQUIRED: ReviewAction[] = ['RETURN', 'REJECT']