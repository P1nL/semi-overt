import { ENV, isHttpUrl } from '@/shared/config/env'

function getApiOrigin(): string | null {
    const base = ENV.apiBaseUrl?.trim()
    if (!base || !isHttpUrl(base)) {
        return null
    }

    try {
        return new URL(base).origin
    } catch {
        return null
    }
}

export function resolveAssetUrl(value?: string | null): string | null {
    const raw = value?.trim()
    if (!raw) {
        return null
    }

    if (isHttpUrl(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
        return raw
    }

    const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`
    const apiOrigin = getApiOrigin()

    if (apiOrigin) {
        try {
            return new URL(normalizedPath, apiOrigin).toString()
        } catch {
            return `${apiOrigin}${normalizedPath}`
        }
    }

    return normalizedPath
}
