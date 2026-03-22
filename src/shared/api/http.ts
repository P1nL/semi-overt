import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { ApiBusinessError } from '../types/api'
import { ENV } from '@/shared/config/env'

const DEFAULT_TIMEOUT = 15000
const REFRESH_TOKEN_HEADER_KEYS = ['new-token', 'x-new-token', 'x-access-token', 'authorization']
const SKIP_AUTH_HEADER = 'X-Skip-Auth'

function getApiBaseURL(): string {
    return ENV.apiBaseUrl || '/api/v1'
}

function getStoredToken(): string | null {
    try {
        return localStorage.getItem(ENV.tokenStorageKey)
    } catch {
        return null
    }
}

function setStoredToken(token: string): void {
    try {
        localStorage.setItem(ENV.tokenStorageKey, token)
    } catch {
        // ignore storage errors
    }
}

function normalizeAuthHeaderToken(rawValue: string | null | undefined): string | null {
    if (!rawValue) {
        return null
    }

    if (rawValue.startsWith('Bearer ')) {
        return rawValue.slice(7).trim()
    }

    return rawValue.trim()
}

function attachAuthToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    const skipAuth = config.headers?.[SKIP_AUTH_HEADER]
    if (skipAuth) {
        delete config.headers[SKIP_AUTH_HEADER]
        return config
    }

    const token = getStoredToken()

    if (token) {
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${token}`
    }

    return config
}

function tryPersistRefreshedToken(instanceErrorOrResponse: unknown): void {
    if (
        !instanceErrorOrResponse ||
        typeof instanceErrorOrResponse !== 'object' ||
        !('headers' in instanceErrorOrResponse)
    ) {
        return
    }

    const headers = (instanceErrorOrResponse as { headers?: Record<string, string | undefined> }).headers
    if (!headers) {
        return
    }

    for (const key of REFRESH_TOKEN_HEADER_KEYS) {
        const raw = headers[key]
        const token = normalizeAuthHeaderToken(raw)
        if (token) {
            setStoredToken(token)
            return
        }
    }
}

function createHttpError(error: AxiosError): ApiBusinessError {
    const status = error.response?.status
    const payload = error.response?.data

    if (payload && typeof payload === 'object') {
        const maybePayload = payload as Record<string, unknown>
        const code = typeof maybePayload.code === 'number' ? maybePayload.code : status ?? -1
        const message =
            typeof maybePayload.message === 'string'
                ? maybePayload.message
                : error.message || '请求失败'

        return new ApiBusinessError(message, {
            code,
            status,
            details: maybePayload.data ?? payload,
        })
    }

    if (error.code === 'ECONNABORTED') {
        return new ApiBusinessError('请求超时，请稍后重试', {
            code: status ?? -1,
            status,
            details: error,
        })
    }

    if (!error.response) {
        return new ApiBusinessError('网络异常，请检查连接后重试', {
            code: -1,
            details: error,
        })
    }

    return new ApiBusinessError(error.message || '请求失败', {
        code: status ?? -1,
        status,
        details: payload,
    })
}

const http: AxiosInstance = axios.create({
    baseURL: getApiBaseURL(),
    timeout: DEFAULT_TIMEOUT,
    withCredentials: false,
})

http.interceptors.request.use(
    (config) => attachAuthToken(config),
    (error) => Promise.reject(error),
)

http.interceptors.response.use(
    (response) => {
        tryPersistRefreshedToken(response)
        return response
    },
    (error: AxiosError) => {
        if (error.response) {
            tryPersistRefreshedToken(error.response)
        }

        return Promise.reject(createHttpError(error))
    },
)

export { http }
export default http
