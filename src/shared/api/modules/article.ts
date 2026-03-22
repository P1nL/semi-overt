import request from '../request'
import { normalizeArticleDetailDto } from '../adapters'
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

export function createArticle(): Promise<CreateArticleRespDto> {
    return request.post<CreateArticleRespDto>(ARTICLE_BASE)
}

export function saveDraft(articleId: number | string, payload: SaveDraftReqDto): Promise<SaveDraftRespDto> {
    return request.put<SaveDraftRespDto>(`${ARTICLE_BASE}/${articleId}/draft`, payload)
}

export function getDraftList(): Promise<DraftItemRespDto[]> {
    return request.get<DraftItemRespDto[]>(`${ARTICLE_BASE}/drafts`)
}

export function getArticleDetail(articleId: number | string): Promise<ArticleDetailRespDto> {
    return request.get<any>(`${ARTICLE_BASE}/${articleId}`).then(normalizeArticleDetailDto)
}

export function submitArticle(articleId: number | string): Promise<SubmitArticleRespDto> {
    return request.post<SubmitArticleRespDto>(`${ARTICLE_BASE}/${articleId}/submit`)
}

export function cancelReview(articleId: number | string): Promise<CancelReviewRespDto> {
    return request.post<CancelReviewRespDto>(`${ARTICLE_BASE}/${articleId}/cancel-review`)
}

export function deleteArticle(articleId: number | string): Promise<null> {
    return request.delete<null>(`${ARTICLE_BASE}/${articleId}`)
}

export function adminDeleteArticle(articleId: number | string): Promise<AdminDeleteArticleRespDto> {
    return request.delete<AdminDeleteArticleRespDto>(`${ADMIN_ARTICLE_BASE}/${articleId}`)
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
