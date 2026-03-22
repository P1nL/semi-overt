import request from '../request'
import {
    normalizePendingReviewListResp,
    normalizeReviewLogListResp,
} from '../adapters'
import type {
    PaginationParams,
    PendingReviewListRespDto,
    ReviewActionReqDto,
    ReviewActionRespDto,
    ReviewLogRespDto,
} from '../../types/api'

const REVIEW_BASE = '/reviews'

export function getPendingReviews(params?: PaginationParams): Promise<PendingReviewListRespDto> {
    return request.get<any>(`${REVIEW_BASE}/pending`, params).then(normalizePendingReviewListResp)
}

export function submitReviewAction(
    articleId: number | string,
    payload: ReviewActionReqDto,
): Promise<ReviewActionRespDto> {
    return request.post<ReviewActionRespDto>(`${REVIEW_BASE}/${articleId}/action`, payload)
}

export function getReviewLogs(articleId: number | string): Promise<ReviewLogRespDto[]> {
    return request.get<any>(`${REVIEW_BASE}/${articleId}/logs`).then(normalizeReviewLogListResp)
}

export const reviewApi = {
    getPendingReviews,
    submitReviewAction,
    getReviewLogs,
}

export default reviewApi
