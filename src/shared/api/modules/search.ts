import request from '../request'
import {
    normalizeSearchResp,
    normalizeUserSearchResp,
    type BackendSearchResp,
    type BackendUserSearchResp,
} from '../adapters'
import type {
    PaginationParams,
    SearchArticleRespDto,
    SearchUserRespDto as GeneratedSearchUserRespDto,
    UserSearchItemDto as GeneratedUserSearchItemDto,
} from '../../types/api'

export type UserSearchItemDto = GeneratedUserSearchItemDto
export type UserSearchRespDto = GeneratedSearchUserRespDto

export function searchArticles(
    params: { keyword: string } & PaginationParams,
): Promise<SearchArticleRespDto> {
    return request.get<BackendSearchResp>('/search', params).then((response) => {
        const normalized = normalizeSearchResp(response)
        return {
            ...normalized,
            keyword: params.keyword,
        }
    })
}

export function searchUsers(
    params: { keyword: string } & PaginationParams,
): Promise<UserSearchRespDto> {
    return request.get<BackendUserSearchResp>('/search/users', params).then((response) => {
        const normalized = normalizeUserSearchResp({
            ...response,
            keyword: response.keyword ?? params.keyword,
        })
        return {
            ...normalized,
            keyword: params.keyword,
        }
    })
}

export const searchApi = {
    searchArticles,
    searchUsers,
}

export default searchApi
