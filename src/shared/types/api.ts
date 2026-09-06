export * from '@/shared/api/generated/contracts'

export interface ApiResponse<T = unknown> {
    code: number
    message: string
    data: T
}

export class ApiBusinessError extends Error {
    code: number
    details?: unknown
    status?: number

    constructor(message: string, options?: { code?: number; details?: unknown; status?: number }) {
        super(message)
        this.name = 'ApiBusinessError'
        this.code = options?.code ?? -1
        this.details = options?.details
        this.status = options?.status
    }
}

/**
 * local: keep the error in the calling feature.
 * auth: additionally handle expired authentication (401).
 * route: allow a main route resource to navigate on 403/404.
 */
export type ApiErrorPolicy = 'local' | 'auth' | 'route'

export interface RequestConfig {
    headers?: Record<string, string>
    signal?: AbortSignal
    timeout?: number
    withAuth?: boolean
    errorPolicy?: ApiErrorPolicy
    rawResponse?: boolean
}
