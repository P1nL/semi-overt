import type { ReviewActionReqDto, ReviewActionRespDto } from '@/shared/types/api'

export type ReviewActionValue = ReviewActionReqDto['action']

export interface ReviewActionFormValues {
    action: ReviewActionValue
    reason: string
}

export type ReviewActionFieldErrors = Partial<Record<'reason', string>>

export interface ReviewActionValidationResult {
    valid: boolean
    errors: ReviewActionFieldErrors
}

export interface ReviewActionOption {
    value: ReviewActionValue
    label: string
    variant: 'success' | 'warning' | 'danger'
}

export interface ReviewActionResult extends ReviewActionRespDto {}

