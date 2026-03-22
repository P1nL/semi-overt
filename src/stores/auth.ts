import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { userApi } from '@/shared/api/modules/user'
import { ENV } from '@/shared/config/env'
import { AUTH_BIZ_CODE } from '@/shared/constants/auth'
import { STORAGE_KEY } from '@/shared/constants/storage'
import { localStore } from '@/shared/utils/storage'
import { getErrorMessage } from '@/shared/utils/error'
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

function readTokenFromStorage() {
    try {
        return localStorage.getItem(ENV.tokenStorageKey)
    } catch {
        return null
    }
}

function writeTokenToStorage(token: string | null) {
    try {
        if (token) {
            localStorage.setItem(ENV.tokenStorageKey, token)
        } else {
            localStorage.removeItem(ENV.tokenStorageKey)
        }
    } catch {
        // ignore storage error
    }
}

function readUserFromStorage(): AuthUser | null {
    if (!localStore) return null
    return localStore.get<AuthUser | null>(STORAGE_KEY.AUTH_USER, null)
}

function writeUserToStorage(user: AuthUser | null) {
    if (!localStore) return

    if (user) {
        localStore.set(STORAGE_KEY.AUTH_USER, user)
    } else {
        localStore.remove(STORAGE_KEY.AUTH_USER)
    }
}

export const useAuthStore = defineStore('auth', () => {
    const token = ref<string | null>(readTokenFromStorage())
    const user = ref<AuthUser | null>(readUserFromStorage())
    const authError = ref<AuthErrorState>({
        code: null,
        message: '',
    })

    const isAuthenticated = computed(() => Boolean(token.value))
    const role = computed<UserRole | null>(() => user.value?.role ?? null)
    const isAdmin = computed(() => role.value === 'ADMIN')
    const displayName = computed(() => user.value?.nickname || user.value?.username || '')
    const hasAuthError = computed(() => authError.value.code !== null)

    function setToken(nextToken: string | null) {
        token.value = nextToken
        writeTokenToStorage(nextToken)
    }

    function setUser(nextUser: AuthUser | null) {
        user.value = nextUser
        writeUserToStorage(nextUser)
    }

    function setAuth(payload: { token: string; user: AuthUser }) {
        setToken(payload.token)
        setUser(payload.user)
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
        setToken(null)
        setUser(null)

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
