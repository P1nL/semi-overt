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

const DEFAULT_ERROR_MESSAGE = '请求失败，请稍后重试'

const ENGLISH_ERROR_MESSAGE_MAP: Array<[RegExp, string]> = [
    [/^Network Error$/i, '网络异常，请检查连接后重试'],
    [/timeout of \d+ms exceeded/i, '请求超时，请稍后重试'],
    [/^Request failed with status code 400$/i, '请求参数不正确，请检查后重试'],
    [/^Request failed with status code 401$/i, '登录状态已失效，请重新登录'],
    [/^Request failed with status code 403$/i, '当前账号没有访问权限'],
    [/^Request failed with status code 404$/i, '请求的内容不存在或已被删除'],
    [/^Request failed with status code 409$/i, '当前状态不允许执行该操作'],
    [/^Request failed with status code 413$/i, '上传内容过大，请压缩后重试'],
    [/^Request failed with status code 500$/i, '服务器异常，请稍后重试'],
    [/^Request failed with status code 502$/i, '网关异常，请稍后重试'],
    [/^Request failed with status code 503$/i, '服务暂时不可用，请稍后重试'],
    [/^Request failed with status code 504$/i, '网关响应超时，请稍后重试'],
    [/^Article not found$/i, '文章不存在或已被删除'],
    [/^User not found$/i, '用户不存在'],
    [/^Current user is required$/i, '请先登录后再操作'],
    [/^Administrator role is required$/i, '需要管理员权限'],
    [/^Username already exists$/i, '用户名已存在'],
    [/^Email already registered$/i, '邮箱已注册'],
    [/^Username or email already exists$/i, '用户名或邮箱已存在'],
    [/^Invalid account or password$/i, '账号或密码错误'],
    [/^Captcha verification failed$/i, '人机验证失败，请重试'],
    [/^At least one draft field is required$/i, '请至少填写一项草稿内容'],
    [/^Cannot submit another user's article$/i, '不能提交其他用户的文章'],
    [/^Article status does not allow submission/i, '当前文章状态不允许提交审核'],
    [/^Access denied$/i, '当前账号没有访问权限'],
    [/^Cannot cancel another user's article review$/i, '不能取消其他用户文章的审核'],
    [/^Only pending articles can cancel review$/i, '只有待审核文章可以取消审核'],
    [/^Cannot delete another user's article$/i, '不能删除其他用户的文章'],
    [/^Article status does not allow delete/i, '当前文章状态不允许删除'],
    [/^Cannot edit another user's article$/i, '不能编辑其他用户的文章'],
    [/^Current status does not allow saving drafts/i, '当前文章状态不允许保存草稿'],
    [/^Upload file is required$/i, '请选择要上传的文件'],
    [/^Upload file exceeds max size$/i, '上传文件超过大小限制'],
    [/^Unsupported image type/i, '不支持该图片格式'],
    [/^Unsupported image content type/i, '不支持该图片类型'],
    [/^Invalid image file$/i, '图片文件无效，请重新选择'],
    [/^Invalid upload path$/i, '上传路径无效'],
    [/^Upload file extension is required$/i, '上传文件缺少扩展名'],
    [/^Article is no longer pending review/i, '文章已不在待审核状态'],
    [/^Administrators cannot review their own article$/i, '管理员不能审核自己发布的文章'],
    [/^Reason is required for RETURN and REJECT$/i, '退回或拒绝时必须填写原因'],
    [/Content must be at least 50 characters before submit/i, '正文字数不足，至少需要 50 个字符后才能提交'],
]

function hasChineseText(value: string): boolean {
    return /[\u3400-\u9fff]/.test(value)
}

function hasEnglishText(value: string): boolean {
    return /[a-z]/i.test(value)
}

function normalizeMessage(message: string | undefined, fallback: string): string {
    const trimmed = message?.trim() ?? ''

    if (!trimmed) {
        return fallback
    }

    for (const [pattern, replacement] of ENGLISH_ERROR_MESSAGE_MAP) {
        if (pattern.test(trimmed)) {
            return replacement
        }
    }

    if (hasEnglishText(trimmed) && !hasChineseText(trimmed)) {
        return hasChineseText(fallback) ? fallback : DEFAULT_ERROR_MESSAGE
    }

    return trimmed
}

export function getErrorMessage(error: unknown, fallback = '请求失败，请稍后重试'): string {
    const normalizedFallback = normalizeMessage(fallback, DEFAULT_ERROR_MESSAGE)

    if (typeof error === 'string') {
        return normalizeMessage(error, normalizedFallback)
    }

    const maybeError = error as ErrorWithMessage | undefined
    const responseMessage = maybeError?.response?.data?.message

    if (responseMessage) {
        return normalizeMessage(responseMessage, normalizedFallback)
    }

    if (maybeError?.message) {
        return normalizeMessage(maybeError.message, normalizedFallback)
    }

    if (error instanceof Error && error.message) {
        return normalizeMessage(error.message, normalizedFallback)
    }

    return normalizedFallback
}
