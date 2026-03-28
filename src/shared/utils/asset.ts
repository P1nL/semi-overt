import { ENV, isHttpUrl } from '@/shared/config/env'

function getAssetOrigin(): string | null {
    const base = ENV.assetBaseUrl?.trim()
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
    const assetOrigin = getAssetOrigin()

    if (assetOrigin) {
        try {
            return new URL(normalizedPath, assetOrigin).toString()
        } catch {
            return `${assetOrigin}${normalizedPath}`
        }
    }

    return normalizedPath
}
