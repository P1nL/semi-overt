import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { queryKeys } from '@/shared/api/queryKeys'
import { queryClient } from '@/shared/lib/queryClient'
import { userApi } from '@/shared/api/modules/user'
import { AUTH_BIZ_CODE } from '@/shared/constants/auth'
import { getErrorMessage } from '@/shared/utils/error'
import {
    clearStoredAuth,
    readStoredAuth,
    type AuthPersistence,
    writeStoredToken,
    writeStoredUser,
} from '@/shared/utils/authStorage'
import { ApiBusinessError } from '@/shared/types/api'

export type UserRole = 'USER' | 'ADMIN'

export interface AuthUser {
    id: number | string
    username: string
    nickname?: string | null
    avatar?: string | null
    role: UserRole
}

export interface AuthErrorState {
    code: number | null
    message: string
}

function clearAuthScopedQueries() {
    queryClient.removeQueries({
        predicate: (query) => {
            const [rootKey] = query.queryKey as readonly unknown[]

            return (
                rootKey === queryKeys.userProfile('', '', 0, 0)[0] ||
                rootKey === queryKeys.reviewPendingRoot[0] ||
                rootKey === queryKeys.reviewLogs('')[0]
            )
        },
    })
}

export const useAuthStore = defineStore('auth', () => {
    const storedAuth = readStoredAuth<AuthUser>()
    const authPersistence = ref<AuthPersistence>(storedAuth.persistence ?? 'local')
    const token = ref<string | null>(storedAuth.token)
    const user = ref<AuthUser | null>(storedAuth.user)
    const authError = ref<AuthErrorState>({
        code: null,
        message: '',
    })

    const isAuthenticated = computed(() => Boolean(token.value))
    const role = computed<UserRole | null>(() => user.value?.role ?? null)
    const isAdmin = computed(() => role.value === 'ADMIN')
    const displayName = computed(() => user.value?.nickname || user.value?.username || '')
    const hasAuthError = computed(() => authError.value.code !== null)

    function setToken(nextToken: string | null, persistence = authPersistence.value) {
        authPersistence.value = persistence
        token.value = nextToken
        writeStoredToken(nextToken, persistence)
    }

    function setUser(nextUser: AuthUser | null, persistence = authPersistence.value) {
        authPersistence.value = persistence
        user.value = nextUser
        writeStoredUser(nextUser, persistence)
    }

    function setAuth(
        payload: { token: string; user: AuthUser },
        options: { persistence?: AuthPersistence } = {},
    ) {
        clearAuthScopedQueries()
        const persistence = options.persistence ?? 'local'
        setToken(payload.token, persistence)
        setUser(payload.user, persistence)
        clearAuthError()
    }

    function patchUser(patch: Partial<AuthUser>) {
        if (!user.value) return
        setUser({
            ...user.value,
            ...patch,
        })
    }

    function clearAuth(options: { keepError?: boolean } = {}) {
        clearAuthScopedQueries()
        token.value = null
        user.value = null
        authPersistence.value = 'local'
        clearStoredAuth()

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
            return
        }

        if (code === AUTH_BIZ_CODE.FORBIDDEN) {
            setAuthError(AUTH_BIZ_CODE.FORBIDDEN, message || '当前账号没有访问权限')
            return
        }

        setAuthError(code, message || '请求失败')
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

    return {
        token,
        user,
        authError,

        isAuthenticated,
        role,
        isAdmin,
        displayName,
        hasAuthError,

        setToken,
        setUser,
        setAuth,
        patchUser,
        clearAuth,

        setAuthError,
        clearAuthError,
        handleAuthBizCode,
        fetchCurrentUser,
    }
})
