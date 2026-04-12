import request from '../request'
import { normalizeSearchResp, type BackendSearchResp } from '../adapters'
import type { PaginationParams, SearchArticleRespDto } from '../../types/api'

export function searchArticles(
    params: { keyword: string } & PaginationParams,
): Promise<SearchArticleRespDto> {
    return request.get<BackendSearchResp>('/search/articles', params).then(normalizeSearchResp)
}

export const searchApi = {
    searchArticles,
}

export default searchApi
