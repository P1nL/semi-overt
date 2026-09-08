import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

import { ENV } from '@/shared/config/env'
import {
    getAccessToken,
    isAuthRefreshCancelledError,
    isAuthRefreshError,
    isAuthRefreshUnauthorizedError,
    refreshAccessToken,
} from './authRuntime'
import { ApiBusinessError, type ApiErrorPolicy } from '../types/api'
import { runApiSideEffects } from './response'

const DEFAULT_TIMEOUT = 15_000
const SKIP_AUTH_CONFIG_KEY = '__skipAuth'
const SKIP_REFRESH_CONFIG_KEY = '__skipAuthRefresh'
const AUTH_RETRY_CONFIG_KEY = '__authRetry'
const ERROR_POLICY_CONFIG_KEY = '__errorPolicy'

const REFRESH_EXCLUDED_PATHS = new Set([
    '/auth/login',
    '/auth/register',
    '/auth/logout',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
])

type AuthAwareRequestConfig = InternalAxiosRequestConfig & {
    [SKIP_AUTH_CONFIG_KEY]?: boolean
    [SKIP_REFRESH_CONFIG_KEY]?: boolean
    [AUTH_RETRY_CONFIG_KEY]?: boolean
    [ERROR_POLICY_CONFIG_KEY]?: ApiErrorPolicy
}

function getApiBaseURL(): string {
    return ENV.apiBaseUrl || '/api/v1'
}

function normalizePath(rawUrl: string | undefined): string {
    if (!rawUrl) return ''

    const withoutQuery = rawUrl.split(/[?#]/)[0] || ''
    const basePath = getApiBaseURL().replace(/https?:\/\/[^/]+/i, '').replace(/\/$/, '')
    if (basePath && withoutQuery.startsWith(basePath)) {
        return withoutQuery.slice(basePath.length) || '/'
    }

    return withoutQuery
}

function isRefreshExcludedRequest(config: AuthAwareRequestConfig): boolean {
    return REFRESH_EXCLUDED_PATHS.has(normalizePath(config.url))
}

function attachAuthToken(config: AuthAwareRequestConfig): AuthAwareRequestConfig {
    if (config[SKIP_AUTH_CONFIG_KEY]) {
        if (config.headers) {
            delete config.headers.Authorization
        }
        return config
    }

    const token = getAccessToken()
    if (token) {
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${token}`
    }

    return config
}

function getResponseMessage(error: AxiosError): string {
    const payload = error.response?.data
    if (payload && typeof payload === 'object' && 'message' in payload) {
        const message = (payload as { message?: unknown }).message
        if (typeof message === 'string' && message.trim()) return message
    }

    return error.message || '请求失败'
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

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
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

function createRefreshError(error: unknown): ApiBusinessError {
    if (isAuthRefreshCancelledError(error)) {
        return new ApiBusinessError('登录会话已结束', {
            code: -1,
            details: error,
        })
    }

    if (isAuthRefreshError(error)) {
        return new ApiBusinessError(error.message || '会话刷新失败，请稍后重试', {
            code: error.code ?? (isAuthRefreshUnauthorizedError(error) ? 401 : -1),
            status: error.status,
            details: error.details,
        })
    }

    return new ApiBusinessError('会话刷新失败，请稍后重试', {
        code: -1,
        details: error,
    })
}

function shouldRefresh(config: AuthAwareRequestConfig | undefined, error: AxiosError): config is AuthAwareRequestConfig {
    if (!config || error.response?.status !== 401) return false
    if (config[SKIP_AUTH_CONFIG_KEY] || config[SKIP_REFRESH_CONFIG_KEY]) return false
    if (config[AUTH_RETRY_CONFIG_KEY] || isRefreshExcludedRequest(config)) return false
    return true
}

const http: AxiosInstance = axios.create({
    baseURL: getApiBaseURL(),
    timeout: DEFAULT_TIMEOUT,
    withCredentials: true,
})

http.interceptors.request.use(
    (config) => attachAuthToken(config as AuthAwareRequestConfig),
    (error) => Promise.reject(error),
)

http.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const config = error.config as AuthAwareRequestConfig | undefined

        if (shouldRefresh(config, error)) {
            try {
                await refreshAccessToken()
            } catch (refreshError) {
                // Only a definitive refresh 401 invalidates the memory session.
                // Network errors, timeouts, and 5xx responses leave it intact.
                if (isAuthRefreshError(refreshError) && isAuthRefreshUnauthorizedError(refreshError)) {
                    await runApiSideEffects(
                        401,
                        refreshError.message || '登录状态已失效，请重新登录',
                        config[ERROR_POLICY_CONFIG_KEY] ?? 'auth',
                    )
                }

                return Promise.reject(createRefreshError(refreshError))
            }
            config[AUTH_RETRY_CONFIG_KEY] = true
            delete config.headers.Authorization
            return http.request(config)
        }

        if (error.response && config) {
            const policy = config[ERROR_POLICY_CONFIG_KEY] ?? 'auth'
            const status = error.response.status

            if (status === 401) {
                if (config[AUTH_RETRY_CONFIG_KEY] && !config[SKIP_REFRESH_CONFIG_KEY]) {
                    await runApiSideEffects(status, getResponseMessage(error), policy)
                }
            } else {
                await runApiSideEffects(status, getResponseMessage(error), policy)
            }
        }

        return Promise.reject(createHttpError(error))
    },
)

export { http }
export default http
