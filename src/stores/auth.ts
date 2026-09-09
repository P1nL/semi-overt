import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { queryClient } from '@/shared/lib/queryClient'
import { userApi } from '@/shared/api/modules/user'
import {
    acceptSession,
    hasPendingLogout,
    getAccessToken,
    invalidateSession,
    isAuthRefreshCancelledError,
    isAuthRefreshUnauthorizedError,
    refreshAccessToken,
    subscribe as subscribeAuthRuntime,
    type AuthRuntimeEvent,
} from '@/shared/api/authRuntime'
import { AUTH_BIZ_CODE } from '@/shared/constants/auth'
import { getErrorMessage } from '@/shared/utils/error'
import { ApiBusinessError, type AuthRespDto } from '@/shared/types/api'

export type UserRole = 'USER' | 'ADMIN'
export type SessionRestoreState = 'idle' | 'restoring' | 'ready' | 'unauthorized' | 'unavailable'

export interface AuthUser {
    id: number | string
    username: string
    nickname?: string | null
    avatar?: string | null
    role: UserRole
    profileLoaded?: boolean
}

export interface AuthErrorState {
    code: number | null
    message: string
}

function clearAllQueries() {
    queryClient.clear()
}

function mapAuthResponseToUser(payload: AuthRespDto): AuthUser {
    return {
        id: payload.user.id,
        username: payload.user.username,
        nickname: payload.user.nickname ?? payload.user.username,
        avatar: payload.user.avatarUrl ?? null,
        role: payload.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
        profileLoaded: false,
    }
}

export const useAuthStore = defineStore('auth', () => {
    const token = ref<string | null>(getAccessToken())
    const user = ref<AuthUser | null>(null)
    const authError = ref<AuthErrorState>({
        code: null,
        message: '',
    })
    const sessionRestoreState = ref<SessionRestoreState>('idle')
    const sessionRestoreMessage = ref('')

    let sessionRestorePromise: Promise<void> | null = null

    const isAuthenticated = computed(() => Boolean(token.value))
    const role = computed<UserRole | null>(() => user.value?.role ?? null)
    const isAdmin = computed(() => role.value === 'ADMIN')
    const displayName = computed(() => user.value?.nickname || user.value?.username || '')
    const hasAuthError = computed(() => authError.value.code !== null)
    const hasCurrentUserProfile = computed(() => user.value?.profileLoaded === true)

    function applyAuthResponse(
        payload: AuthRespDto,
        options: { clearQueries?: boolean; preserveProfileState?: boolean } = {},
    ) {
        if (options.clearQueries) {
            clearAllQueries()
        }

        token.value = payload.token
        const nextUser = mapAuthResponseToUser(payload)
        if (
            options.preserveProfileState
            && user.value
            && String(user.value.id) === String(nextUser.id)
        ) {
            nextUser.profileLoaded = user.value.profileLoaded
        }
        user.value = nextUser
        clearAuthError()
    }

    function setToken(nextToken: string | null) {
        token.value = nextToken
        if (!nextToken) {
            user.value = null
        }
    }

    function setUser(nextUser: AuthUser | null) {
        user.value = nextUser
    }

    function setAuth(payload: { token: string; user: AuthUser }) {
        acceptSession({
            token: payload.token,
            user: {
                id: Number(payload.user.id),
                username: payload.user.username,
                nickname: payload.user.nickname ?? payload.user.username,
                email: null,
                role: payload.user.role,
                avatarUrl: payload.user.avatar ?? null,
            },
        })
        clearAllQueries()
        token.value = payload.token
        user.value = payload.user
        sessionRestoreState.value = 'ready'
        clearAuthError()
    }

    function patchUser(patch: Partial<AuthUser>) {
        if (!user.value) return
        setUser({
            ...user.value,
            ...patch,
        })
    }

    function clearAuth(options: { keepError?: boolean; skipRuntime?: boolean } = {}) {
        clearAllQueries()
        if (!options.skipRuntime) {
            invalidateSession()
        }
        token.value = null
        user.value = null

        if (!options.keepError) {
            clearAuthError()
        }
    }

    function setAuthError(code: number | null, message = '') {
        authError.value = {
            code,
            message,
        }
    }

    function clearAuthError() {
        setAuthError(null, '')
    }

    function handleAuthBizCode(code: number, message?: string) {
        if (code === AUTH_BIZ_CODE.UNAUTHORIZED) {
            clearAuth({ keepError: true })
            setAuthError(AUTH_BIZ_CODE.UNAUTHORIZED, message || '登录状态已失效，请重新登录')
            sessionRestoreState.value = 'unauthorized'
            return
        }

        if (code === AUTH_BIZ_CODE.FORBIDDEN) {
            setAuthError(AUTH_BIZ_CODE.FORBIDDEN, message || '当前账号没有访问权限')
            return
        }

        setAuthError(code, message || '请求失败')
    }

    async function ensureSessionRestored(): Promise<void> {
        if (sessionRestoreState.value !== 'idle') {
            await sessionRestorePromise
            return
        }

        if (token.value) {
            sessionRestoreState.value = 'ready'
            return
        }

        sessionRestoreState.value = 'restoring'
        sessionRestorePromise = refreshAccessToken()
            .then((payload) => {
                applyAuthResponse(payload)
                sessionRestoreState.value = 'ready'
            })
            .catch((error) => {
                if (isAuthRefreshUnauthorizedError(error)) {
                    clearAuth({ keepError: true })
                    setAuthError(AUTH_BIZ_CODE.UNAUTHORIZED, '登录状态已失效，请重新登录')
                    sessionRestoreState.value = 'unauthorized'
                    return
                }

                if (isAuthRefreshCancelledError(error)) {
                    clearAuth({ keepError: true, skipRuntime: true })
                    sessionRestoreState.value = 'unauthorized'
                    return
                }

                // Offline/timeout/5xx must not be converted into a credential
                // failure.  Later protected requests may retry refresh.
                sessionRestoreMessage.value = getErrorMessage(error, '暂时无法恢复本设备登录状态，请稍后重试')
                sessionRestoreState.value = 'unavailable'
            })
            .finally(() => {
                sessionRestorePromise = null
            })

        await sessionRestorePromise
    }

    async function retrySessionRestore(): Promise<void> {
        if (sessionRestoreState.value !== 'unavailable') return
        sessionRestoreState.value = 'idle'
        await ensureSessionRestored()
    }

    async function fetchCurrentUser() {
        try {
            const response = await userApi.getCurrentUser()

            setUser({
                id: response.id,
                username: response.username,
                nickname: response.nickname ?? response.username,
                avatar: response.avatarUrl ?? null,
                role: response.role === 'ADMIN' ? 'ADMIN' : 'USER',
                profileLoaded: true,
            })
            clearAuthError()
        } catch (error) {
            const message = getErrorMessage(error, '获取当前用户失败')
            if (error instanceof ApiBusinessError) {
                handleAuthBizCode(error.code, message)
            } else {
                handleAuthBizCode(AUTH_BIZ_CODE.SERVER_ERROR, message)
            }
            throw error
        }
    }

    function handleRuntimeEvent(event: AuthRuntimeEvent) {
        if (event.type === 'refreshed') {
            applyAuthResponse(event.session, { preserveProfileState: true })
            sessionRestoreState.value = 'ready'
            return
        }

        clearAuth({ skipRuntime: true })
        if (event.type === 'logout-pending') {
            sessionRestoreMessage.value = event.message
            sessionRestoreState.value = 'unavailable'
            return
        }
        // A deliberate local/remote logout is not an error. The pending marker
        // only prevents a reload from restoring the session while confirmation
        // is in flight; it must not display the failure banner by itself.
        sessionRestoreMessage.value = ''
        sessionRestoreState.value = 'unauthorized'
    }

    subscribeAuthRuntime(handleRuntimeEvent)

    return {
        token,
        user,
        authError,
        sessionRestoreState,
        sessionRestoreMessage,

        isAuthenticated,
        role,
        isAdmin,
        displayName,
        hasAuthError,
        hasCurrentUserProfile,

        setToken,
        setUser,
        setAuth,
        patchUser,
        clearAuth,

        setAuthError,
        clearAuthError,
        handleAuthBizCode,
        ensureSessionRestored,
        retrySessionRestore,
        fetchCurrentUser,
    }
})
