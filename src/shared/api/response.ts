import { ApiBusinessError, type ApiErrorPolicy, type ApiResponse } from '../types/api'

export interface ApiSideEffectHandlers {
    onUnauthorized?: () => void | Promise<void>
    onForbidden?: (message: string) => void | Promise<void>
    onNotFound?: () => void | Promise<void>
}

export interface UnwrapApiResponseOptions {
    errorPolicy?: ApiErrorPolicy
}

let sideEffectHandlers: ApiSideEffectHandlers = {}

export function registerApiSideEffectHandlers(handlers: ApiSideEffectHandlers): void {
    sideEffectHandlers = handlers
}

export function isApiResponse<T = unknown>(value: unknown): value is ApiResponse<T> {
    if (!value || typeof value !== 'object') {
        return false
    }

    const record = value as Record<string, unknown>

    return (
        typeof record.code === 'number' &&
        typeof record.message === 'string' &&
        'data' in record
    )
}

export function isBusinessSuccess(code: number): boolean {
    return code === 200
}

export async function runApiSideEffects(
    code: number,
    message: string,
    errorPolicy: ApiErrorPolicy = 'auth',
): Promise<void> {
    if (errorPolicy === 'local') {
        return
    }
    if (code === 401) {
        await sideEffectHandlers.onUnauthorized?.()
        return
    }

    if (errorPolicy !== 'route') {
        return
    }

    if (code === 403) {
        await sideEffectHandlers.onForbidden?.(message || '无权限访问')
        return
    }

    if (code === 404) {
        await sideEffectHandlers.onNotFound?.()
    }
}

export async function unwrapApiResponse<T>(
    payload: unknown,
    options: UnwrapApiResponseOptions = {},
): Promise<T> {
    if (!isApiResponse<T>(payload)) {
        throw new ApiBusinessError('响应格式不合法', {
            code: -1,
            details: payload,
        })
    }

    if (!isBusinessSuccess(payload.code)) {
        await runApiSideEffects(
            payload.code,
            payload.message,
            options.errorPolicy ?? 'auth',
        )

        throw new ApiBusinessError(payload.message || '请求失败', {
            code: payload.code,
            details: payload.data,
        })
    }

    return payload.data
}
