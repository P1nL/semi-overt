import axios from 'axios'

import { normalizeAuthResp, type BackendAuthResp } from './adapters'
import { ENV } from '@/shared/config/env'
import type { ApiResponse, AuthRespDto } from '@/shared/types/api'
import { clearLegacyAuthStorage } from '@/shared/utils/authStorage'

const DEFAULT_TIMEOUT = 15_000
const REFRESH_LOCK_NAME = 'semi-overt-auth-refresh'
const REFRESH_COORDINATION_CHANNEL = 'now.auth.session.v1'
const LOGOUT_MARKER_KEY = 'now.auth.logout.v1'
const PENDING_LOGOUT_KEY = 'now.auth.pending-logout.v1'

clearLegacyAuthStorage()

type AuthRefreshFailureKind = 'unauthorized' | 'transient' | 'permanent' | 'cancelled'

export class AuthRefreshError extends Error {
    readonly status?: number
    readonly code?: number
    readonly kind: AuthRefreshFailureKind
    readonly details?: unknown

    constructor(
        message: string,
        options: {
            kind: AuthRefreshFailureKind
            status?: number
            code?: number
            details?: unknown
            cause?: unknown
        },
    ) {
        super(message)
        if (options.cause !== undefined) {
            Object.defineProperty(this, 'cause', { value: options.cause, enumerable: false })
        }
        this.name = 'AuthRefreshError'
        this.status = options.status
        this.code = options.code
        this.kind = options.kind
        this.details = options.details
    }
}

export type AuthRuntimeEvent =
    | { type: 'refreshed'; session: AuthRespDto }
    | { type: 'remote-logout' }

type AuthRuntimeMessage =
    | { type: 'logout'; sourceId: string; marker: string }
    | { type: 'refresh-released'; sourceId: string }


const tabId = createId()
let accessToken: string | null = null
let logoutEpoch = 0
let logoutInProgress = Boolean(readCoordinationValue(PENDING_LOGOUT_KEY))
let logoutPromise: Promise<void> | null = null
let refreshPromise: Promise<AuthRespDto> | null = null
let coordinationChannel: BroadcastChannel | null = null
let lastLogoutMarker = readCoordinationValue(LOGOUT_MARKER_KEY)
const eventListeners = new Set<(event: AuthRuntimeEvent) => void>()


function createId(): string {
    const cryptoObject = globalThis.crypto as Crypto | undefined
    if (cryptoObject?.randomUUID) {
        return cryptoObject.randomUUID()
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getCoordinationStorage(): Storage | null {
    if (typeof window === 'undefined') return null

    try {
        return window.localStorage
    } catch {
        return null
    }
}

function coordinationStorageReadable(): boolean {
    try {
        const storage = getCoordinationStorage()
        if (!storage) return false
        storage.getItem(PENDING_LOGOUT_KEY)
        return true
    } catch { return false }
}

function readCoordinationValue(key: string): string | null {
    const storage = getCoordinationStorage()
    if (!storage) return null

    try {
        return storage.getItem(key)
    } catch {
        return null
    }
}

function writeCoordinationValue(key: string, value: string): void {
    const storage = getCoordinationStorage()
    if (!storage) return

    try {
        storage.setItem(key, value)
    } catch {
        // BroadcastChannel remains available when localStorage is disabled.
    }
}

function removeCoordinationValue(key: string): void {
    const storage = getCoordinationStorage()
    if (!storage) return

    try {
        storage.removeItem(key)
    } catch {
        // Ignore coordination cleanup failures.
    }
}

function syncLogoutMarker(): void {
    const marker = readCoordinationValue(LOGOUT_MARKER_KEY)
    if (marker && marker !== lastLogoutMarker) {
        lastLogoutMarker = marker
        applyRemoteLogout()
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === LOGOUT_MARKER_KEY || event.key === PENDING_LOGOUT_KEY) syncLogoutMarker()
    })
}

function ensureCoordinationChannel(): BroadcastChannel | null {
    if (coordinationChannel) return coordinationChannel
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null

    coordinationChannel = new BroadcastChannel(REFRESH_COORDINATION_CHANNEL)
    coordinationChannel.addEventListener('message', (event: MessageEvent<AuthRuntimeMessage>) => {
        const message = event.data
        if (!message || message.sourceId === tabId) return

        if (message.type === 'logout') {
            if (message.marker === lastLogoutMarker) return
            lastLogoutMarker = message.marker
            applyRemoteLogout()
            return
        }


    })

    return coordinationChannel
}

function broadcast(message: AuthRuntimeMessage): void {
    ensureCoordinationChannel()?.postMessage(message)
}

export async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
    const locks = typeof navigator !== 'undefined'
        ? (navigator as Navigator & {
            locks?: {
                request<TValue>(
                    name: string,
                    options: { mode: 'exclusive' },
                    callback: () => Promise<TValue>,
                ): Promise<TValue>
            }
        }).locks
        : undefined

    if (locks) {
        return locks.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, task)
    }

    // No localStorage read-back can provide mutual exclusion. Fail closed.
    throw new AuthRefreshError('此浏览器不支持安全的跨标签会话协调，请使用支持 Web Locks 的浏览器', { kind: 'transient' })
}

function emit(event: AuthRuntimeEvent): void {
    for (const listener of [...eventListeners]) {
        try {
            listener(event)
        } catch {
            // A stale UI subscriber must not break token rotation.
        }
    }
}

function getResponseMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object' && 'message' in payload) {
        const message = (payload as { message?: unknown }).message
        if (typeof message === 'string' && message.trim()) return message
    }

    return fallback
}

function classifyRefreshStatus(status: number | undefined): AuthRefreshFailureKind {
    if (status === 401) return 'unauthorized'
    if (status !== undefined && status >= 500) return 'transient'
    return 'permanent'
}

function toAuthRefreshError(error: unknown): AuthRefreshError {
    if (error instanceof AuthRefreshError) return error

    if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const payload = error.response?.data
        return new AuthRefreshError(
            getResponseMessage(payload, !error.response ? '网络异常，请检查连接后重试' : error.message || '会话刷新失败'),
            {
                kind: !error.response ? 'transient' : classifyRefreshStatus(status),
                status,
                code: payload && typeof payload === 'object' && 'code' in payload
                    && typeof (payload as { code?: unknown }).code === 'number'
                    ? (payload as { code: number }).code
                    : status,
                details: payload,
                cause: error,
            },
        )
    }

    return new AuthRefreshError('会话刷新失败，请稍后重试', {
        kind: 'transient',
        cause: error,
    })
}

async function requestRefresh(): Promise<AuthRespDto> {
    try {
        const response = await axios.post<ApiResponse<BackendAuthResp>>(
            `${ENV.apiBaseUrl || '/api'}/auth/refresh`,
            undefined,
            {
                timeout: DEFAULT_TIMEOUT,
                withCredentials: true,
            },
        )
        const payload = response.data

        if (!payload || typeof payload !== 'object' || payload.code !== 200 || !payload.data) {
            const responseCode = typeof payload?.code === 'number' ? payload.code : response.status
            throw new AuthRefreshError(
                getResponseMessage(payload, '会话刷新失败，请重新登录'),
                {
                    kind: classifyRefreshStatus(responseCode),
                    status: response.status,
                    code: responseCode,
                    details: payload?.data,
                },
            )
        }

        const session = normalizeAuthResp(payload.data)
        if (!session.token) {
            throw new AuthRefreshError('会话刷新响应缺少访问令牌', {
                kind: 'permanent',
                status: response.status,
                code: response.status,
                details: payload.data,
            })
        }

        return session
    } catch (error) {
        throw toAuthRefreshError(error)
    }
}

function applyRemoteLogout(): void {
    logoutEpoch += 1
    logoutInProgress = true
    accessToken = null
    emit({ type: 'remote-logout' })
}

export function subscribe(listener: (event: AuthRuntimeEvent) => void): () => void {
    eventListeners.add(listener)
    ensureCoordinationChannel()
    return () => eventListeners.delete(listener)
}

export function getAccessToken(): string | null {
    return accessToken
}

export function acceptSession(session: AuthRespDto): void {
    logoutEpoch += 1
    removeCoordinationValue(PENDING_LOGOUT_KEY)
    logoutInProgress = false
    accessToken = session.token
}

export function invalidateSession(): void {
    logoutEpoch += 1
    accessToken = null
}

export function beginLogout(): void {
    logoutEpoch += 1
    logoutInProgress = true
    accessToken = null

    const marker = `${Date.now()}-${tabId}-${logoutEpoch}`
    lastLogoutMarker = marker
    writeCoordinationValue(PENDING_LOGOUT_KEY, marker)
    writeCoordinationValue(LOGOUT_MARKER_KEY, marker)
    emit({ type: 'remote-logout' })
    if (readCoordinationValue(PENDING_LOGOUT_KEY) !== marker) {
        throw new AuthRefreshError('无法保存待退出状态，请允许浏览器存储并重试退出', { kind: 'transient' })
    }
    broadcast({ type: 'logout', sourceId: tabId, marker })
}

export function isLogoutInProgress(): boolean {
    return logoutInProgress
}

export function hasPendingLogout(): boolean {
    return Boolean(readCoordinationValue(PENDING_LOGOUT_KEY))
}

/** The cookie mutation must run AFTER any already-running refresh response. */
export async function flushPendingLogout(): Promise<void> {
    if (logoutPromise) return logoutPromise
    logoutPromise = withRefreshLock(async () => {
        if (!hasPendingLogout()) return
        const response = await axios.post<ApiResponse<null>>(
            `${ENV.apiBaseUrl || '/api/v1'}/auth/logout`, undefined, { timeout: DEFAULT_TIMEOUT, withCredentials: true },
        )
        if (response.data?.code !== 200) throw new Error('服务器尚未确认退出，请重试')
        removeCoordinationValue(PENDING_LOGOUT_KEY)
        emit({ type: 'remote-logout' })
        if (hasPendingLogout()) throw new Error('无法保存退出确认，请检查浏览器存储设置')
    }).catch((error) => {
        throw new AuthRefreshError('服务器尚未确认退出；自动登录已暂停，请联网后重试退出', { kind: 'transient', cause: error })
    }).finally(() => { logoutPromise = null })
    return logoutPromise
}

export async function logoutDevice(): Promise<void> {
    if (!hasPendingLogout()) beginLogout()
    await flushPendingLogout()
}

export async function refreshAccessToken(): Promise<AuthRespDto> {
    syncLogoutMarker()
    // Verify persistent storage availability before allowing automatic login.
    if (!coordinationStorageReadable()) throw new AuthRefreshError('无法读取设备会话状态，请允许浏览器存储后重试', { kind: 'transient' })
    if (hasPendingLogout()) {
        logoutInProgress = true
        await flushPendingLogout()
    }
    if (logoutInProgress) {
        throw new AuthRefreshError('登录会话已结束', { kind: 'cancelled' })
    }

    if (refreshPromise) return refreshPromise

    const refreshEpoch = logoutEpoch
    refreshPromise = withRefreshLock(async () => {
        if (logoutInProgress || hasPendingLogout() || refreshEpoch !== logoutEpoch) {
            throw new AuthRefreshError('登录会话已结束', { kind: 'cancelled' })
        }

        const session = await requestRefresh()

        if (logoutInProgress || hasPendingLogout() || refreshEpoch !== logoutEpoch) {
            throw new AuthRefreshError('登录会话已结束', { kind: 'cancelled' })
        }

        accessToken = session.token
        emit({ type: 'refreshed', session })
        return session
    }).finally(() => {
        refreshPromise = null
    })

    return refreshPromise
}

export function isAuthRefreshError(error: unknown): error is AuthRefreshError {
    return error instanceof AuthRefreshError
}

export function isAuthRefreshUnauthorizedError(error: unknown): boolean {
    return isAuthRefreshError(error) && error.kind === 'unauthorized'
}

export function isAuthRefreshTransientError(error: unknown): boolean {
    return isAuthRefreshError(error) && error.kind === 'transient'
}

export function isAuthRefreshCancelledError(error: unknown): boolean {
    return isAuthRefreshError(error) && error.kind === 'cancelled'
}
