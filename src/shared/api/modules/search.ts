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
    return request.get<BackendSearchResp>('/search/articles', params).then(normalizeSearchResp)
}

export function searchUsers(
    params: { keyword: string } & PaginationParams,
): Promise<UserSearchRespDto> {
    return request.get<BackendUserSearchResp>('/search/users', params).then(normalizeUserSearchResp)
}

export const searchApi = {
    searchArticles,
    searchUsers,
}

export default searchApi
