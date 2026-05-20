import type { Router } from 'vue-router'
import { registerApiSideEffectHandlers } from '@/shared/api/response'
import { pinia } from '@/app/providers/pinia'
import { AUTH_BIZ_CODE } from '@/shared/constants/auth'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'
import { ROUTE_NAME, ROUTE_PATH } from '@/shared/constants/routes'

let isHandlingUnauthorized = false

const AUTH_ROUTE_PATHS = new Set<string>([
    ROUTE_PATH.LOGIN,
    ROUTE_PATH.REGISTER,
    ROUTE_PATH.FORGOT_PASSWORD,
    ROUTE_PATH.RESET_PASSWORD,
])

function normalizePathname(rawPath: string | null | undefined): string {
    if (!rawPath) return ''

    try {
        return new URL(rawPath, window.location.origin).pathname
    } catch {
        return rawPath.split(/[?#]/)[0] || ''
    }
}

function isAuthRoutePath(rawPath: string | null | undefined): boolean {
    return AUTH_ROUTE_PATHS.has(normalizePathname(rawPath))
}

function readHistoryBackPath(): string {
    if (typeof window === 'undefined') return ''

    const historyState = window.history.state as { back?: string | null } | null
    return historyState?.back ?? ''
}

function resolveSheetBackgroundPath(currentPath: string): string {
    const backPath = readHistoryBackPath()
    const normalizedBackPath = normalizePathname(backPath)
    const normalizedCurrentPath = normalizePathname(currentPath)

    if (
        backPath &&
        normalizedBackPath &&
        normalizedBackPath !== normalizedCurrentPath &&
        !isAuthRoutePath(backPath)
    ) {
        return backPath
    }

    return ROUTE_PATH.HOME
}

function routeRequiresAuth(router: Router): boolean {
    const currentRoute = router.currentRoute.value

    return currentRoute.matched.some((record) =>
        Boolean(record.meta.requiresAuth || record.meta.roles?.length),
    )
}

export function setupApiSideEffects(router: Router): void {
    registerApiSideEffectHandlers({
        onUnauthorized: async () => {
            if (isHandlingUnauthorized) {
                return
            }

            isHandlingUnauthorized = true

            try {
                const authStore = useAuthStore(pinia)
                const sessionStore = useSessionStore(pinia)

                authStore.handleAuthBizCode(AUTH_BIZ_CODE.UNAUTHORIZED, '登录状态已失效，请重新登录')
                sessionStore.setAuthCode(AUTH_BIZ_CODE.UNAUTHORIZED)

                const currentRoute = router.currentRoute.value
                const isAlreadyAuthPage = isAuthRoutePath(currentRoute.fullPath)
                const shouldRedirectToLogin = routeRequiresAuth(router)

                if (!isAlreadyAuthPage && shouldRedirectToLogin) {
                    const redirectPath = currentRoute.fullPath || ROUTE_PATH.HOME
                    sessionStore.setAuthRedirect(redirectPath)
                    sessionStore.setAuthSheetBackground(
                        currentRoute.meta.presentation === 'sheet'
                            ? resolveSheetBackgroundPath(redirectPath)
                            : '',
                    )
                    await router.push({
                        path: ROUTE_PATH.HOME,
                        query: { auth: 'login' },
                    })
                }
            } finally {
                isHandlingUnauthorized = false
            }
        },

        onForbidden: async (message: string) => {
            const authStore = useAuthStore(pinia)
            const sessionStore = useSessionStore(pinia)

            authStore.handleAuthBizCode(AUTH_BIZ_CODE.FORBIDDEN, message || '无权限访问')
            sessionStore.markForbidden(message || '无权限访问')

            if (router.currentRoute.value.path !== ROUTE_PATH.FORBIDDEN) {
                await router.push(ROUTE_PATH.FORBIDDEN)
            }
        },

        onNotFound: async () => {
            if (router.currentRoute.value.name !== ROUTE_NAME.NOT_FOUND) {
                await router.push({
                    name: ROUTE_NAME.NOT_FOUND,
                    params: {
                        pathMatch: ['404'],
                    },
                })
            }
        },
    })
}
