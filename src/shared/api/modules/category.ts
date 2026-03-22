import request from '../request'
import {
    normalizeCategoryResp,
    normalizeHomeResp,
    normalizeSearchResp,
} from '../adapters'
import type {
    CategoryRespDto,
    HomeRespDto,
    PaginationParams,
    SearchArticleRespDto,
} from '../../types/api'

export type DurationCategory = 'QUICK' | 'SHORT' | 'DEEP'

export function getHomeContent(): Promise<HomeRespDto> {
    return request.get<any>('/home').then(normalizeHomeResp)
}

export function getCategoryArticles(
    category: DurationCategory | string,
    params?: PaginationParams,
): Promise<CategoryRespDto> {
    return request
        .get<any>(`/categories/${category}/articles`, params)
        .then(normalizeCategoryResp)
}

export function searchArticles(
    params: { keyword: string } & PaginationParams,
): Promise<SearchArticleRespDto> {
    return request.get<any>('/search/articles', params).then(normalizeSearchResp)
}

export const categoryApi = {
    getHomeContent,
    getCategoryArticles,
    searchArticles,
}

export default categoryApi
