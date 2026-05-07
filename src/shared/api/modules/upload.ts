import request from '../request'
import type { UploadBizType, UploadImageRespDto } from '../../types/api'

const UPLOAD_BASE = '/upload'

export interface UploadImagePayload {
    file: File
    bizType: UploadBizType
    articleId?: number | string
    /** AVATAR/COVER 场景：旧文件访问 URL，上传成功后后端自动删除旧文件 */
    oldUrl?: string
}

export function uploadImage(payload: UploadImagePayload): Promise<UploadImageRespDto> {
    const formData = new FormData()
    formData.append('file', payload.file)
    formData.append('bizType', payload.bizType)

    if (payload.articleId !== undefined && payload.articleId !== null) {
        formData.append('articleId', String(payload.articleId))
    }

    if (payload.oldUrl) {
        formData.append('oldUrl', payload.oldUrl)
    }

    return request.upload<{
        url: string
        width?: number | null
        height?: number | null
        size: number
        dominantColor?: string | null
    }>(UPLOAD_BASE, formData).then((response) => ({
        url: response.url,
        width: response.width ?? 0,
        height: response.height ?? 0,
        size: response.size,
        dominantColor: response.dominantColor ?? null,
    }))
}

export const uploadApi = {
    uploadImage,
}

export default uploadApi
