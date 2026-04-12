import request from '../request'
import {
    normalizeReviewLogListResp,
    type BackendReviewLogResp,
} from '../adapters'
import type {
    PageRespDto,
    PaginationParams,
    PendingReviewItemDto,
    ReviewActionReqDto,
    ReviewActionRespDto,
    ReviewLogRespDto,
} from '../../types/api'

const REVIEW_BASE = '/reviews'

export function getPendingReviews(params?: PaginationParams): Promise<PageRespDto<PendingReviewItemDto>> {
    return request.get<PageRespDto<PendingReviewItemDto>>(`${REVIEW_BASE}/pending`, params)
}

export function submitReviewAction(
    articleId: number | string,
    payload: ReviewActionReqDto,
): Promise<ReviewActionRespDto> {
    return request.post<ReviewActionRespDto>(`${REVIEW_BASE}/${articleId}/action`, payload)
}

export function getReviewLogs(articleId: number | string): Promise<ReviewLogRespDto[]> {
    return request.get<BackendReviewLogResp[]>(`${REVIEW_BASE}/${articleId}/logs`).then(normalizeReviewLogListResp)
}

export const reviewApi = {
    getPendingReviews,
    submitReviewAction,
    getReviewLogs,
}

export default reviewApi
