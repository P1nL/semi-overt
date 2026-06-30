import { ENV } from '@/shared/config/env'

export function formatDocumentTitle(value?: string | null) {
    const title = value?.trim()
    return title ? `${title} - ${ENV.appName}` : ENV.appName
}

export function setDocumentTitle(value?: string | null) {
    document.title = formatDocumentTitle(value)
}
