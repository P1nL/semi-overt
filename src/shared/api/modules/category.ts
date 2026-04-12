import request from '../request'
import {
    normalizeCategoryResp,
    type BackendCategoryResp,
} from '../adapters'
import type {
    CategoryRespDto,
    PaginationParams,
} from '../../types/api'

export type DurationCategory = 'QUICK' | 'SHORT' | 'DEEP'

export function getCategoryArticles(
    category: DurationCategory | string,
    params?: PaginationParams,
): Promise<CategoryRespDto> {
    return request
        .get<BackendCategoryResp>(`/categories/${category}/articles`, params)
        .then(normalizeCategoryResp)
}

export const categoryApi = {
    getCategoryArticles,
}

export default categoryApi
