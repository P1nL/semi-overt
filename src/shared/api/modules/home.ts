import request from '../request'
import { normalizeHomeResp, type BackendHomeResp } from '../adapters'
import type { HomeRespDto } from '../../types/api'

export function getHomeContent(): Promise<HomeRespDto> {
    return request.get<BackendHomeResp>('/home').then(normalizeHomeResp)
}

export function setHomePin(articleId: number, pinned: boolean): Promise<{ articleId: number; homePinned: boolean }> {
    return request.put(`/admin/articles/${articleId}/home-pin`, { pinned })
}

export const homeApi = {
    getHomeContent,
    setHomePin,
}

export default homeApi
