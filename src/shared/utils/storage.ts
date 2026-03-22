export function getStorageItem<T>(storage: Storage, key: string, fallback: T): T {
    const raw = storage.getItem(key)

    if (raw == null) {
        return fallback
    }

    try {
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

export const localStore =
    typeof window !== 'undefined' ? createStorageNamespace(window.localStorage) : null

export const sessionStore =
    typeof window !== 'undefined' ? createStorageNamespace(window.sessionStorage) : null