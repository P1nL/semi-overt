import type { UploadBizType } from '@/shared/types/api'

export interface ImageUploadParams {
    file: File
    bizType: UploadBizType
    articleId?: number | string
    /** AVATAR/COVER 场景：旧文件访问 URL，上传成功后后端自动删除旧文件 */
    oldUrl?: string
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

