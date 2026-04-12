import request from '../request'
import {
    normalizeProfileDto,
    normalizeUserProfileResp,
    type BackendUserInfoResp,
    type BackendUserProfileResp,
} from '../adapters'
import type {
    PaginationParams,
    ProfileDto,
    UpdateProfileReqDto,
    UserProfileRespDto,
} from '../../types/api'

const USER_BASE = '/users'

export interface GetUserProfileParams extends PaginationParams {
    tab?: 'all' | 'approved' | 'pending' | 'returned' | 'rejected' | 'draft' | string
}

export function getCurrentUser(): Promise<ProfileDto & { email?: string | null; role?: string }> {
    return request.get<BackendUserInfoResp>(`${USER_BASE}/me`).then(normalizeProfileDto)
}

export function updateMyProfile(payload: UpdateProfileReqDto): Promise<ProfileDto> {
    return request.put<BackendUserInfoResp>(`${USER_BASE}/me/profile`, payload).then(normalizeProfileDto)
}

export function getUserProfile(
    username: string,
    params?: GetUserProfileParams,
): Promise<UserProfileRespDto> {
    return request
        .get<BackendUserProfileResp>(`${USER_BASE}/${encodeURIComponent(username)}/profile`, params)
        .then(normalizeUserProfileResp)
}

export const userApi = {
    getCurrentUser,
    updateMyProfile,
    getUserProfile,
}

export default userApi
