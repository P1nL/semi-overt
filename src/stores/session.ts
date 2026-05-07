import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { AUTH_BIZ_CODE } from '@/shared/constants/auth'
import { STORAGE_KEY } from '@/shared/constants/storage'
import { sessionStore } from '@/shared/utils/storage'

const AUTH_SHEET_BACKGROUND_STORAGE_KEY = 'now.authSheetBackground'

function readAuthRedirectFromStorage() {
    return sessionStore?.get<string>(STORAGE_KEY.AUTH_REDIRECT, '') ?? ''
}

function writeAuthRedirectToStorage(value: string) {
    if (!sessionStore) return

    if (value) {
        sessionStore.set(STORAGE_KEY.AUTH_REDIRECT, value)
    } else {
        sessionStore.remove(STORAGE_KEY.AUTH_REDIRECT)
    }
}

function readAuthSheetBackgroundFromStorage() {
    return sessionStore?.get<string>(AUTH_SHEET_BACKGROUND_STORAGE_KEY, '') ?? ''
}

function writeAuthSheetBackgroundToStorage(value: string) {
    if (!sessionStore) return

    if (value) {
        sessionStore.set(AUTH_SHEET_BACKGROUND_STORAGE_KEY, value)
    } else {
        sessionStore.remove(AUTH_SHEET_BACKGROUND_STORAGE_KEY)
    }
}

export const useSessionStore = defineStore('session', () => {
    const authRedirect = ref(readAuthRedirectFromStorage())
    const authSheetBackground = ref(readAuthSheetBackgroundFromStorage())
    const lastAuthCode = ref<number | null>(null)
    const forbiddenMessage = ref('')

    const hasAuthRedirect = computed(() => Boolean(authRedirect.value))
    const hasAuthSheetBackground = computed(() => Boolean(authSheetBackground.value))
    const isUnauthorized = computed(() => lastAuthCode.value === AUTH_BIZ_CODE.UNAUTHORIZED)
    const isForbidden = computed(() => lastAuthCode.value === AUTH_BIZ_CODE.FORBIDDEN)

    function setAuthRedirect(path: string) {
        authRedirect.value = path
        writeAuthRedirectToStorage(path)
    }

    function setAuthSheetBackground(path: string) {
        authSheetBackground.value = path
        writeAuthSheetBackgroundToStorage(path)
    }

    function consumeAuthRedirect(defaultPath = '/') {
        const target = authRedirect.value || defaultPath
        setAuthRedirect('')
        return target
    }

    function consumeAuthSheetBackground(defaultPath = '/') {
        const target = authSheetBackground.value || defaultPath
        setAuthSheetBackground('')
        return target
    }

    function setAuthCode(code: number | null) {
        lastAuthCode.value = code
    }

    function markForbidden(message: string) {
        setAuthCode(AUTH_BIZ_CODE.FORBIDDEN)
        forbiddenMessage.value = message || '无权限访问'
    }

    function clearForbidden() {
        forbiddenMessage.value = ''
        if (lastAuthCode.value === AUTH_BIZ_CODE.FORBIDDEN) {
            setAuthCode(null)
        }
    }

    function resetSessionState() {
        setAuthRedirect('')
        setAuthSheetBackground('')
        lastAuthCode.value = null
        forbiddenMessage.value = ''
    }

    return {
        authRedirect,
        authSheetBackground,
        lastAuthCode,
        forbiddenMessage,

        hasAuthRedirect,
        hasAuthSheetBackground,
        isUnauthorized,
        isForbidden,

        setAuthRedirect,
        setAuthSheetBackground,
        consumeAuthRedirect,
        consumeAuthSheetBackground,
        setAuthCode,
        markForbidden,
        clearForbidden,
        resetSessionState,
    }
})
