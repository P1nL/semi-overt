import request from '../request'
import { refreshAccessToken, logoutDevice, withRefreshLock, acceptSession } from '../authRuntime'
import { normalizeAuthResp, type BackendAuthResp } from '../adapters'
import type {
    AuthRespDto,
    ForgotPasswordReqDto,
    LoginReqDto,
    RegisterReqDto,
    ResetPasswordReqDto,
} from '../../types/api'

const AUTH_BASE = '/auth'

export interface RegisterCodeReqDto {
    email: string
    cfTurnstileToken?: string
}

export function sendRegisterCode(payload: RegisterCodeReqDto): Promise<null> {
    return request.post<null>(`${AUTH_BASE}/register-code`, payload, {
        withAuth: false,
        skipAuthRefresh: true,
        errorPolicy: 'local',
    })
}

export function register(payload: RegisterReqDto): Promise<AuthRespDto> {
    return withRefreshLock(() => request.post<BackendAuthResp>(`${AUTH_BASE}/register`, payload, {
        withAuth: false,
        skipAuthRefresh: true,
        errorPolicy: 'local',
    }).then((response) => {
        const session = normalizeAuthResp(response)
        acceptSession(session)
        return session
    }))
}

export function login(payload: LoginReqDto): Promise<AuthRespDto> {
    return withRefreshLock(() => request.post<BackendAuthResp>(`${AUTH_BASE}/login`, payload, {
        withAuth: false,
        skipAuthRefresh: true,
        errorPolicy: 'local',
    }).then((response) => {
        const session = normalizeAuthResp(response)
        acceptSession(session)
        return session
    }))
}

/** Refresh is also used by the Axios interceptor, so it bypasses Axios itself. */
export function refresh(): Promise<AuthRespDto> {
    return refreshAccessToken()
}

/** Logout is cookie-authorised and deliberately does not require a bearer. */
export function logout(): Promise<null> {
    return logoutDevice().then(() => null)
}

export function forgotPassword(payload: ForgotPasswordReqDto): Promise<null> {
    return request.post<null>(`${AUTH_BASE}/forgot-password`, payload, {
        withAuth: false,
        skipAuthRefresh: true,
        errorPolicy: 'local',
    })
}

export function resetPassword(payload: ResetPasswordReqDto): Promise<null> {
    return request.post<null>(`${AUTH_BASE}/reset-password`, payload, {
        withAuth: false,
        skipAuthRefresh: true,
        errorPolicy: 'local',
    })
}

export const authApi = {
    sendRegisterCode,
    register,
    login,
    refresh,
    logout,
    forgotPassword,
    resetPassword,
}

export default authApi
