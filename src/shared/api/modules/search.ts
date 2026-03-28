import request from '../request'
import { normalizeSearchResp } from '../adapters'
import type { PaginationParams, SearchArticleRespDto } from '../../types/api'

export function searchArticles(
    params: { keyword: string } & PaginationParams,
): Promise<SearchArticleRespDto> {
    return request.get<any>('/search/articles', params).then(normalizeSearchResp)
}

export const searchApi = {
    searchArticles,
}

export default searchApi
