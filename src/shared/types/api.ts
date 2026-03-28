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

export interface RequestConfig {
    headers?: Record<string, string>
    signal?: AbortSignal
    timeout?: number
    withAuth?: boolean
    rawResponse?: boolean
}
