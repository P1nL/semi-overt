import type {
    RouteLocationNormalized,
    RouteLocationRaw,
    Router,
} from 'vue-router'

import { pinia } from '@/app/providers/pinia'
import { ENV } from '@/shared/config/env'
import { ROUTE_PATH } from '@/shared/constants/routes'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'

let currentUserRefreshPromise: Promise<void> | null = null
const AUTH_ROUTE_PATHS = new Set<string>([
    ROUTE_PATH.LOGIN,
    ROUTE_PATH.REGISTER,
    ROUTE_PATH.FORGOT_PASSWORD,
    ROUTE_PATH.RESET_PASSWORD,
])

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

function resolveAuthRole(authStore: ReturnType<typeof useAuthStore>) {
    const role =
        typeof authStore.role === 'string'
            ? authStore.role
            : authStore.user?.role

    return role as 'USER' | 'ADMIN' | undefined
}

async function refreshCurrentUser(authStore: ReturnType<typeof useAuthStore>) {
    if (!currentUserRefreshPromise) {
        currentUserRefreshPromise = authStore.fetchCurrentUser().finally(() => {
            currentUserRefreshPromise = null
        })
    }

    await currentUserRefreshPromise
}

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

function resolveAuthSheetBackground(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
): string {
    if (to.meta.presentation !== 'sheet') {
        return ''
    }

    const fromPath = from.fullPath || ''
    const normalizedFromPath = normalizePathname(fromPath)
    const normalizedToPath = normalizePathname(to.fullPath)

    if (
        fromPath &&
        normalizedFromPath &&
        normalizedFromPath !== normalizedToPath &&
        !isAuthRoutePath(fromPath)
    ) {
        return fromPath
    }

    return ROUTE_PATH.HOME
}

function persistAuthPromptDestination(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
) {
    const sessionStore = useSessionStore(pinia)
    sessionStore.setAuthRedirect(to.fullPath || ROUTE_PATH.HOME)
    sessionStore.setAuthSheetBackground(resolveAuthSheetBackground(to, from))
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

async function handleAuthGuard(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
) {
    const { authStore, isAuthenticated } = resolveAuthState()
    let role = resolveAuthRole(authStore)

    if (to.meta.publicOnly && isAuthenticated) {
        return ROUTE_PATH.HOME
    }

    if (to.meta.requiresAuth && !isAuthenticated) {
        persistAuthPromptDestination(to, from)
        return {
            path: ROUTE_PATH.HOME,
            query: { auth: 'login' },
        }
    }

    if (to.meta.roles?.length) {
        if (!isAuthenticated) {
            persistAuthPromptDestination(to, from)
            return {
                path: ROUTE_PATH.HOME,
                query: { auth: 'login' },
            }
        }

        if (!role || !to.meta.roles.includes(role)) {
            try {
                await refreshCurrentUser(authStore)
                role = resolveAuthRole(authStore)
            } catch {
                if (!authStore.isAuthenticated) {
                    persistAuthPromptDestination(to, from)
                    return {
                        path: ROUTE_PATH.HOME,
                        query: { auth: 'login' },
                    }
                }
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

        return handleAuthGuard(to, from)
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
