type AppEnv = {
    appName: string
    apiBaseUrl: string
    assetBaseUrl: string
    routerBase: string
    tokenStorageKey: string
    isDev: boolean
    isProd: boolean
}

function normalizeBasePath(value: string | undefined, fallback = '/') {
    if (!value) return fallback
    return value.startsWith('/') ? value : `/${value}`
}

export const ENV: AppEnv = {
    appName: import.meta.env.VITE_APP_NAME?.trim() || 'Semi-Overt',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v1',
    assetBaseUrl: import.meta.env.VITE_ASSET_BASE_URL?.trim() || '',
    routerBase: normalizeBasePath(import.meta.env.BASE_URL, '/'),
    tokenStorageKey:
        import.meta.env.VITE_TOKEN_STORAGE_KEY?.trim() || 'now.token',
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
}

export function isHttpUrl(value: string) {
    return /^https?:\/\//.test(value)
}
