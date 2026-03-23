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
