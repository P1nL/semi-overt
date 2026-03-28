import request from '../request'
import { normalizeHomeResp } from '../adapters'
import type { HomeRespDto } from '../../types/api'

export function getHomeContent(): Promise<HomeRespDto> {
    return request.get<any>('/home').then(normalizeHomeResp)
}

export const homeApi = {
    getHomeContent,
}

export default homeApi
