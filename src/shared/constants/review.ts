import { ARTICLE_STATUS } from './article'

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

export const REVIEW_ACTION_RESULT_STATUS_MAP = {
    [REVIEW_ACTION.APPROVE]: ARTICLE_STATUS.APPROVED,
    [REVIEW_ACTION.RETURN]: ARTICLE_STATUS.RETURNED,
    [REVIEW_ACTION.REJECT]: ARTICLE_STATUS.REJECTED,
    [REVIEW_ACTION.CANCEL]: ARTICLE_STATUS.DRAFT,
} as const

export const REVIEW_REASON_MAX_LENGTH = 500