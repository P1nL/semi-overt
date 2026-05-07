import request from '../request'
import {
    normalizePendingReviewListResp,
    normalizeReviewLogListResp,
    type BackendReviewPendingPageResp,
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

const REVIEW_BASE = '/review'

export function getPendingReviews(params?: PaginationParams): Promise<PageRespDto<PendingReviewItemDto>> {
    return request.get<BackendReviewPendingPageResp>(`${REVIEW_BASE}/pending`, params).then(normalizePendingReviewListResp)
}

export function submitReviewAction(
    articleId: number | string,
    payload: ReviewActionReqDto,
): Promise<ReviewActionRespDto> {
    return request.post<{ status?: string; updatedAt?: string }>(`${REVIEW_BASE}/${articleId}/decision`, payload).then((article) => ({
        status: article.status ?? payload.action,
        reviewedAt: article.updatedAt ?? new Date().toISOString(),
    }))
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
