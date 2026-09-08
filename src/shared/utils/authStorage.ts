import { ENV } from '@/shared/config/env'
import { STORAGE_KEY } from '@/shared/constants/storage'

/**
 * Access tokens are intentionally memory-only.  This module exists solely to
 * remove state written by the pre-refresh-cookie client during the one-time
 * migration to device sessions.
 */
interface LegacyStoredAuthState<TUser> {
    token: null
    user: TUser | null
    persistence: null
}

const LEGACY_AUTH_KEYS = [
    ENV.tokenStorageKey,
    STORAGE_KEY.ACCESS_TOKEN,
    STORAGE_KEY.AUTH_USER,
]

function removeRaw(storage: Storage | null, key: string): void {
    if (!storage) return

    try {
        storage.removeItem(key)
    } catch {
        // Ignore storage errors.  Authentication remains memory-only either way.
    }
}

function clearStorage(storage: Storage | null): void {
    for (const key of LEGACY_AUTH_KEYS) {
        removeRaw(storage, key)
    }
}

/** Remove legacy local/session bearer tokens and cached user projections. */
export function clearLegacyAuthStorage(): void {
    if (typeof window === 'undefined') return

    clearStorage(window.localStorage)
    clearStorage(window.sessionStorage)
}

/**
 * Compatibility shim for callers that used to bootstrap from storage.
 * Reading also performs the one-time cleanup so old JWTs cannot be reused.
 */
export function readStoredAuth<TUser>(): LegacyStoredAuthState<TUser> {
    clearLegacyAuthStorage()
    return {
        token: null,
        user: null,
        persistence: null,
    }
}

export function clearStoredAuth(): void {
    clearLegacyAuthStorage()
}
