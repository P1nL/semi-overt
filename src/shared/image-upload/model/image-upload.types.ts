import type { UploadBizType } from '@/shared/types/api'

export interface ImageUploadParams {
    file: File
    bizType: UploadBizType
    articleId?: number | string
}

export interface ImageUploadResult {
    url: string
    width: number
    height: number
    size: number
    dominantColor: string | null
}

export interface ImageValidationResult {
    valid: boolean
    message: string
}

export interface ImageValidationOptions {
    acceptedTypes?: readonly string[]
    maxSizeBytes?: number
}

