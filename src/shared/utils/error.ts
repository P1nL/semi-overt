import { AUTH_BIZ_CODE } from '@/shared/constants/auth'

export interface ErrorWithMessage {
    message?: string
    code?: number | string
    response?: {
        status?: number
        data?: {
            code?: number
            message?: string
        }
    }
}

export function getErrorMessage(error: unknown, fallback = '请求失败，请稍后重试'): string {
    if (typeof error === 'string') {
        return error
    }

    if (error instanceof Error && error.message) {
        return error.message
    }

    const maybeError = error as ErrorWithMessage | undefined

    return (
        maybeError?.response?.data?.message ||
        maybeError?.message ||
        fallback
    )
}

export function getErrorCode(error: unknown): number | string | undefined {
    const maybeError = error as ErrorWithMessage | undefined
    return maybeError?.response?.data?.code ?? maybeError?.code
}

export function isBizUnauthorized(error: unknown): boolean {
    return getErrorCode(error) === AUTH_BIZ_CODE.UNAUTHORIZED
}

export function isBizForbidden(error: unknown): boolean {
    return getErrorCode(error) === AUTH_BIZ_CODE.FORBIDDEN
}

export function isBizNotFound(error: unknown): boolean {
    return getErrorCode(error) === AUTH_BIZ_CODE.NOT_FOUND
}

export function isBizConflict(error: unknown): boolean {
    return getErrorCode(error) === AUTH_BIZ_CODE.CONFLICT
}