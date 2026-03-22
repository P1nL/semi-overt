import { ENV } from '@/shared/config/env'
import { STORAGE_KEY } from '@/shared/constants/storage'

export type AuthPersistence = 'local' | 'session'

interface StoredAuthState<TUser> {
    token: string | null
    user: TUser | null
    persistence: AuthPersistence | null
}

const TOKEN_STORAGE_KEY = ENV.tokenStorageKey
const USER_STORAGE_KEY = STORAGE_KEY.AUTH_USER

function getStorage(persistence: AuthPersistence): Storage | null {
    if (typeof window === 'undefined') {
        return null
    }

    return persistence === 'local' ? window.localStorage : window.sessionStorage
}

function readRaw(storage: Storage | null, key: string): string | null {
    if (!storage) {
        return null
    }

    try {
        return storage.getItem(key)
    } catch {
        return null
    }
}

function writeRaw(storage: Storage | null, key: string, value: string): void {
    if (!storage) {
        return
    }

    try {
        storage.setItem(key, value)
    } catch {
        // ignore storage errors
    }
}

function removeRaw(storage: Storage | null, key: string): void {
    if (!storage) {
        return
    }

    try {
        storage.removeItem(key)
    } catch {
        // ignore storage errors
    }
}

function readUser<TUser>(persistence: AuthPersistence): TUser | null {
    const raw = readRaw(getStorage(persistence), USER_STORAGE_KEY)
    if (raw == null) {
        return null
    }

    try {
        return JSON.parse(raw) as TUser
    } catch {
        return null
    }
}

function writeUser<TUser>(persistence: AuthPersistence, user: TUser): void {
    writeRaw(getStorage(persistence), USER_STORAGE_KEY, JSON.stringify(user))
}

function clearKeyFromAllStorages(key: string): void {
    removeRaw(getStorage('session'), key)
    removeRaw(getStorage('local'), key)
}

function getActivePersistence(): AuthPersistence | null {
    const sessionToken = readRaw(getStorage('session'), TOKEN_STORAGE_KEY)
    if (sessionToken) {
        return 'session'
    }

    const localToken = readRaw(getStorage('local'), TOKEN_STORAGE_KEY)
    if (localToken) {
        return 'local'
    }

    if (readRaw(getStorage('session'), USER_STORAGE_KEY)) {
        return 'session'
    }

    if (readRaw(getStorage('local'), USER_STORAGE_KEY)) {
        return 'local'
    }

    return null
}

export function readStoredAuth<TUser>(): StoredAuthState<TUser> {
    const persistence = getActivePersistence()

    if (!persistence) {
        return {
            token: null,
            user: null,
            persistence: null,
        }
    }

    return {
        token: readRaw(getStorage(persistence), TOKEN_STORAGE_KEY),
        user: readUser<TUser>(persistence),
        persistence,
    }
}

export function readStoredToken(): string | null {
    return readStoredAuth<never>().token
}

export function writeStoredToken(token: string | null, persistence?: AuthPersistence): void {
    if (!token) {
        clearKeyFromAllStorages(TOKEN_STORAGE_KEY)
        return
    }

    const targetPersistence = persistence ?? getActivePersistence() ?? 'local'
    const targetStorage = getStorage(targetPersistence)
    const otherStorage = getStorage(targetPersistence === 'local' ? 'session' : 'local')

    writeRaw(targetStorage, TOKEN_STORAGE_KEY, token)
    removeRaw(otherStorage, TOKEN_STORAGE_KEY)
}

export function writeStoredUser<TUser>(user: TUser | null, persistence?: AuthPersistence): void {
    if (!user) {
        clearKeyFromAllStorages(USER_STORAGE_KEY)
        return
    }

    const targetPersistence = persistence ?? getActivePersistence() ?? 'local'
    const targetStorage = getStorage(targetPersistence)
    const otherStorage = getStorage(targetPersistence === 'local' ? 'session' : 'local')

    writeUser(targetPersistence, user)
    removeRaw(otherStorage, USER_STORAGE_KEY)
}

export function clearStoredAuth(): void {
    clearKeyFromAllStorages(TOKEN_STORAGE_KEY)
    clearKeyFromAllStorages(USER_STORAGE_KEY)
}
