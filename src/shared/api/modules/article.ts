import request from '../request'
import {
    normalizeArticleDetailDto,
    type BackendArticleCardResp,
    type BackendArticleDetailResp,
} from '../adapters'
import { ARTICLE_STATUS } from '@/shared/constants/article'
import type {
    AdminDeleteArticleRespDto,
    ArticleDetailRespDto,
    CancelReviewRespDto,
    CreateArticleRespDto,
    DraftItemRespDto,
    SaveDraftReqDto,
    SaveDraftRespDto,
    SubmitArticleRespDto,
} from '../../types/api'

const ARTICLE_BASE = '/articles'
const ADMIN_ARTICLE_BASE = '/admin/articles'
const PUBLIC_ARTICLE_DETAIL_PATH_PATTERN = /^\/articles\/[^/]+\/?$/
const DRAFT_BOX_STATUSES = new Set<string>([
    ARTICLE_STATUS.DRAFT,
    ARTICLE_STATUS.PENDING,
    ARTICLE_STATUS.RETURNED,
    ARTICLE_STATUS.REJECTED,
])

function isDraftBoxStatus(status?: string | null): boolean {
    return DRAFT_BOX_STATUSES.has(status?.toUpperCase?.() ?? '')
}

function isPublicArticleDetailRoute(): boolean {
    return typeof window !== 'undefined' && PUBLIC_ARTICLE_DETAIL_PATH_PATTERN.test(window.location.pathname)
}

export function createArticle(): Promise<CreateArticleRespDto> {
    return request.post<CreateArticleRespDto>(ARTICLE_BASE)
}

export function saveDraft(articleId: number | string, payload: SaveDraftReqDto): Promise<SaveDraftRespDto> {
    return request.put<BackendArticleDetailResp>(`${ARTICLE_BASE}/${articleId}/draft`, payload).then((article) => ({
        savedAt: article.updatedAt ?? new Date().toISOString(),
        wordCount: article.wordCount ?? 0,
        readMinutes: Number(article.readMinutes ?? 0),
        durationCategory: article.durationCategory ?? 'SHORT',
        status: article.status ?? 'DRAFT',
        draftVisible: article.draftVisible === true,
    }))
}

export function getDraftList(): Promise<DraftItemRespDto[]> {
    return request.get<BackendArticleCardResp[]>(`${ARTICLE_BASE}/drafts`).then((articles) =>
        articles
            .filter((article) => isDraftBoxStatus(article.status))
            .map((article) => ({
                id: article.id ?? article.articleId ?? 0,
                title: article.title ?? null,
                status: article.status ?? 'DRAFT',
                wordCount: article.wordCount ?? 0,
                updatedAt: article.updatedAt ?? article.createdAt ?? new Date().toISOString(),
                latestReason: article.latestReason ?? article.rejectReason ?? null,
                draftVisible: article.draftVisible ?? false,
            })),
    )
}

export function getArticleDetail(articleId: number | string): Promise<ArticleDetailRespDto> {
    return request
        .get<BackendArticleDetailResp>(
            `${ARTICLE_BASE}/${articleId}`,
            undefined,
            isPublicArticleDetailRoute() ? { withAuth: false } : undefined,
        )
        .then(normalizeArticleDetailDto)
}

export function submitArticle(articleId: number | string): Promise<SubmitArticleRespDto> {
    return request.post<BackendArticleDetailResp>(`${ARTICLE_BASE}/${articleId}/submit`).then((article) => ({
        status: article.status ?? 'PENDING',
        submitCount: article.submitCount ?? 0,
        lastSubmittedAt: article.lastSubmittedAt ?? article.updatedAt ?? new Date().toISOString(),
    }))
}

export function cancelReview(articleId: number | string): Promise<CancelReviewRespDto> {
    return request.post<BackendArticleDetailResp>(`${ARTICLE_BASE}/${articleId}/cancel-review`).then((article) => ({
        status: article.status ?? 'DRAFT',
    }))
}

export function deleteArticle(articleId: number | string): Promise<null> {
    return request.delete<null>(`${ARTICLE_BASE}/${articleId}`)
}

export function adminDeleteArticle(articleId: number | string): Promise<AdminDeleteArticleRespDto> {
    return request.delete<null>(`${ADMIN_ARTICLE_BASE}/${articleId}`).then(() => ({ ok: true }))
}

export const articleApi = {
    createArticle,
    saveDraft,
    getDraftList,
    getArticleDetail,
    submitArticle,
    cancelReview,
    deleteArticle,
    adminDeleteArticle,
}

export default articleApi
