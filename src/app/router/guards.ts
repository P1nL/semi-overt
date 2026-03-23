import type {
    NavigationGuardNext,
    RouteLocationNormalized,
    RouteLocationRaw,
    Router,
} from 'vue-router'

import { pinia } from '@/app/providers/pinia'
import { ENV } from '@/shared/config/env'
import {
    ROUTE_NAME,
    ROUTE_PATH,
} from '@/shared/constants/routes'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const REDIRECT_QUERY_KEY = 'redirect'

function resolveAuthState() {
    const authStore = useAuthStore(pinia)

    const isAuthenticated =
        typeof authStore.isAuthenticated === 'boolean'
            ? authStore.isAuthenticated
            : Boolean(authStore.token)

    const role =
        typeof authStore.role === 'string'
            ? authStore.role
            : authStore.user?.role

    return {
        authStore,
        isAuthenticated,
        role: role as 'USER' | 'ADMIN' | undefined,
    }
}

function shouldHandleDrawerNavigation(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
) {
    if (to.fullPath === from.fullPath) return false
    if (to.meta.drawerAware === false) return false
    return true
}

function handleDrawerGuard(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
) {
    const uiStore = useUiStore(pinia)

    if (!uiStore.drawerOpen) return null
    if (!shouldHandleDrawerNavigation(to, from)) return null

    if (uiStore.isDrawerClosing) {
        return false
    }

    const pendingRoute: RouteLocationRaw = to.fullPath

    if (typeof uiStore.setPendingRoute === 'function') {
        uiStore.setPendingRoute(pendingRoute)
    } else {
        uiStore.pendingRoute = pendingRoute
    }

    if (typeof uiStore.skipNextPageTransition === 'function') {
        uiStore.skipNextPageTransition()
    }

    if (typeof uiStore.closeDrawer === 'function') {
        uiStore.closeDrawer()
    } else {
        uiStore.drawerOpen = false
    }

    return false
}

function handleAuthGuard(to: RouteLocationNormalized) {
    const { isAuthenticated, role } = resolveAuthState()

    if (to.meta.publicOnly && isAuthenticated) {
        const redirect =
            typeof to.query[REDIRECT_QUERY_KEY] === 'string'
                ? to.query[REDIRECT_QUERY_KEY]
                : ROUTE_PATH.HOME

        return redirect
    }

    if (to.meta.requiresAuth && !isAuthenticated) {
        return {
            path: ROUTE_PATH.LOGIN,
            query: {
                [REDIRECT_QUERY_KEY]: to.fullPath,
            },
        }
    }

    if (to.meta.roles?.length) {
        if (!isAuthenticated) {
            return {
                path: ROUTE_PATH.LOGIN,
                query: {
                    [REDIRECT_QUERY_KEY]: to.fullPath,
                },
            }
        }

        if (!role || !to.meta.roles.includes(role)) {
            return { path: ROUTE_PATH.FORBIDDEN }
        }
    }

    return true
}

function applyDocumentTitle(to: RouteLocationNormalized) {
    const pageTitle = to.meta.title
    document.title = pageTitle ? `${pageTitle} - ${ENV.appName}` : ENV.appName
}

export function setupRouterGuards(router: Router) {
    router.beforeEach((to, from) => {
        const drawerResult = handleDrawerGuard(to, from)
        if (drawerResult === false) {
            return false
        }

        return handleAuthGuard(to)
    })

    router.afterEach((to) => {
        applyDocumentTitle(to)
    })

    router.onError((error) => {
        if (ENV.isDev) {
            console.error('[router:error]', error)
        }
    })
}
