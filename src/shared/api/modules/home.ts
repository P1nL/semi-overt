import request from '../request'
import { normalizeHomeResp, type BackendHomeResp } from '../adapters'
import type { HomeRespDto } from '../../types/api'

export function getHomeContent(): Promise<HomeRespDto> {
    return request.get<BackendHomeResp>('/home').then(normalizeHomeResp)
}

export const homeApi = {
    getHomeContent,
}

export default homeApi
