import request from '../request'
import { normalizeAuthResp, type BackendAuthResp } from '../adapters'
import type {
    AuthRespDto,
    ForgotPasswordReqDto,
    LoginReqDto,
    RegisterReqDto,
    ResetPasswordReqDto,
} from '../../types/api'

const AUTH_BASE = '/auth'

export function register(payload: RegisterReqDto): Promise<AuthRespDto> {
    return request.post<BackendAuthResp>(`${AUTH_BASE}/register`, payload, {
        withAuth: false,
    }).then(normalizeAuthResp)
}

export function login(payload: LoginReqDto): Promise<AuthRespDto> {
    return request.post<BackendAuthResp>(`${AUTH_BASE}/login`, payload, {
        withAuth: false,
    }).then(normalizeAuthResp)
}

export function logout(): Promise<null> {
    return request.post<null>(`${AUTH_BASE}/logout`)
}

export function forgotPassword(payload: ForgotPasswordReqDto): Promise<null> {
    return request.post<null>(`${AUTH_BASE}/forgot-password`, payload, {
        withAuth: false,
    })
}

export function resetPassword(payload: ResetPasswordReqDto): Promise<null> {
    return request.post<null>(`${AUTH_BASE}/reset-password`, payload, {
        withAuth: false,
    })
}

export const authApi = {
    register,
    login,
    logout,
    forgotPassword,
    resetPassword,
}

export default authApi
