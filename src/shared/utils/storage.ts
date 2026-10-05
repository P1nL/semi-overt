export function getStorageItem<T>(storage: Storage, key: string, fallback: T): T {
    try {
        const raw = storage.getItem(key)
        if (raw == null) return fallback
        return JSON.parse(raw) as T
    } catch {
        return fallback
    }
}

export function setStorageItem<T>(storage: Storage, key: string, value: T): void {
    storage.setItem(key, JSON.stringify(value))
}

export function removeStorageItem(storage: Storage, key: string): void {
    storage.removeItem(key)
}

export function createStorageNamespace(storage: Storage) {
    return {
        get<T>(key: string, fallback: T): T {
            return getStorageItem(storage, key, fallback)
        },
        set<T>(key: string, value: T): void {
            setStorageItem(storage, key, value)
        },
        remove(key: string): void {
            removeStorageItem(storage, key)
        },
    }
}

function browserStorage(kind: 'localStorage' | 'sessionStorage') {
    if (typeof window === 'undefined') return null
    try { return createStorageNamespace(window[kind]) }
    catch { return null }
}

export const localStore = browserStorage('localStorage')
export const sessionStore = browserStorage('sessionStorage')
