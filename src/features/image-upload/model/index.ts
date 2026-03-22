import {
    ARTICLE_IMAGE_ACCEPTED_TYPES,
    ARTICLE_IMAGE_MAX_SIZE_MB,
} from '@/shared/constants/article'
import { resolveAssetUrl } from '@/shared/utils/asset'
import { getErrorMessage } from '@/shared/utils/error'
import { imageUploadApi } from '@/features/image-upload/api'
import type {
    ImageUploadParams,
    ImageUploadResult,
    ImageValidationOptions,
    ImageValidationResult,
} from './image-upload.types'

const DEFAULT_MAX_SIZE_BYTES = ARTICLE_IMAGE_MAX_SIZE_MB * 1024 * 1024

export function formatImageSize(sizeBytes: number): string {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B'

    if (sizeBytes < 1024) return `${sizeBytes} B`
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
}

export function validateImageFile(
    file: File,
    options: ImageValidationOptions = {},
): ImageValidationResult {
    const acceptedTypes = options.acceptedTypes ?? ARTICLE_IMAGE_ACCEPTED_TYPES
    const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES

    if (!acceptedTypes.includes(file.type)) {
        return {
            valid: false,
            message: '仅支持 JPG、PNG、WEBP 图片格式',
        }
    }

    if (file.size > maxSizeBytes) {
        return {
            valid: false,
            message: `图片大小不能超过 ${ARTICLE_IMAGE_MAX_SIZE_MB}MB`,
        }
    }

    return {
        valid: true,
        message: '',
    }
}

export async function uploadImageFile(params: ImageUploadParams): Promise<ImageUploadResult> {
    const validation = validateImageFile(params.file)

    if (!validation.valid) {
        throw new Error(validation.message)
    }

    try {
        const response = await imageUploadApi.uploadImage({
            file: params.file,
            bizType: params.bizType,
            articleId: params.articleId,
        })

        return {
            url: resolveAssetUrl(response.url) ?? '',
            width: response.width,
            height: response.height,
            size: response.size,
            dominantColor: response.dominantColor ?? null,
        }
    } catch (error) {
        throw new Error(getErrorMessage(error, '图片上传失败，请稍后重试'))
    }
}

export type {
    ImageUploadParams,
    ImageUploadResult,
    ImageValidationOptions,
    ImageValidationResult,
}
