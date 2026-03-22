import type { Router } from 'vue-router'
import { registerApiSideEffectHandlers } from '@/shared/api/response'
import { pinia } from '@/app/providers/pinia'
import { AUTH_BIZ_CODE } from '@/shared/constants/auth'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'
import { ROUTE_NAME, ROUTE_PATH } from '@/shared/constants/routes'

let isHandlingUnauthorized = false

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
                const isAlreadyLoginPage = currentRoute.path === ROUTE_PATH.LOGIN

                if (!isAlreadyLoginPage) {
                    sessionStore.setAuthRedirect(currentRoute.fullPath || '')
                    await router.push({
                        path: ROUTE_PATH.LOGIN,
                        query: currentRoute.fullPath
                            ? { redirect: currentRoute.fullPath }
                            : undefined,
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
