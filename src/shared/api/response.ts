import { ApiBusinessError, type ApiResponse } from '../types/api'

export interface ApiSideEffectHandlers {
    onUnauthorized?: () => void | Promise<void>
    onForbidden?: (message: string) => void | Promise<void>
    onNotFound?: () => void | Promise<void>
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

async function runBusinessSideEffects(code: number, message: string): Promise<void> {
    if (code === 401) {
        await sideEffectHandlers.onUnauthorized?.()
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

export async function unwrapApiResponse<T>(payload: unknown): Promise<T> {
    if (!isApiResponse<T>(payload)) {
        throw new ApiBusinessError('响应格式不合法', {
            code: -1,
            details: payload,
        })
    }

    if (!isBusinessSuccess(payload.code)) {
        await runBusinessSideEffects(payload.code, payload.message)

        throw new ApiBusinessError(payload.message || '请求失败', {
            code: payload.code,
            details: payload.data,
        })
    }

    return payload.data
}

export function toApiBusinessError(error: unknown): ApiBusinessError {
    if (error instanceof ApiBusinessError) {
        return error
    }

    if (error instanceof Error) {
        return new ApiBusinessError(error.message, {
            code: -1,
            details: error,
        })
    }

    return new ApiBusinessError('未知错误', {
        code: -1,
        details: error,
    })
}