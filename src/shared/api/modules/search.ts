import request from '../request'
import { normalizeSearchResp, type BackendSearchResp } from '../adapters'
import { resolveAssetUrl } from '@/shared/utils/asset'
import type { PaginationParams, SearchArticleRespDto } from '../../types/api'

interface BackendUserSearchItemResp {
    id: number
    username: string
    nickname?: string | null
    avatarUrl?: string | null
    profilePath?: string | null
}

interface BackendUserSearchResp {
    keyword: string
    list: BackendUserSearchItemResp[]
    total?: number
}

export interface UserSearchItemDto {
    id: number
    username: string
    nickname: string | null
    avatarUrl: string | null
    profilePath: string
}

export interface UserSearchRespDto {
    keyword: string
    list: UserSearchItemDto[]
    total: number
}

function normalizeUserSearchResp(raw: BackendUserSearchResp): UserSearchRespDto {
    const list = (raw.list ?? []).map((item) => ({
        id: item.id,
        username: item.username,
        nickname: item.nickname?.trim() || null,
        avatarUrl: resolveAssetUrl(item.avatarUrl),
        profilePath: item.profilePath?.trim() || `/u/${encodeURIComponent(item.username)}`,
    }))

    return {
        keyword: raw.keyword,
        list,
        total: Number(raw.total ?? list.length),
    }
}

export function searchArticles(
    params: { keyword: string } & PaginationParams,
): Promise<SearchArticleRespDto> {
    return request.get<BackendSearchResp>('/search/articles', params).then(normalizeSearchResp)
}

export function searchUsers(
    params: { keyword: string; limit?: number },
): Promise<UserSearchRespDto> {
    return request.get<BackendUserSearchResp>('/search/users', params).then(normalizeUserSearchResp)
}

export const searchApi = {
    searchArticles,
    searchUsers,
}

export default searchApi
