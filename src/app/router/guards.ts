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

export type RouterGuardRule = {
    name: string
    description: string
}

export const ROUTER_GUARD_RULES: RouterGuardRule[] = [
    {
        name: 'drawer-navigation',
        description:
            '抽屉打开时，优先暂存目标路由并关闭抽屉；真正跳转由抽屉 transitionend 后续流程完成。',
    },
    {
        name: 'auth-required',
        description:
            'meta.requiresAuth=true 时，未登录用户统一跳转到登录页，并携带 redirect 参数。',
    },
    {
        name: 'public-only',
        description:
            'meta.publicOnly=true 时，已登录用户不再进入登录/注册/找回密码页面，直接重定向到目标页或首页。',
    },
    {
        name: 'role-based-access',
        description:
            'meta.roles 存在时按角色校验；无权限进入 /403。',
    },
    {
        name: 'backend-authority-first',
        description:
            '前端守卫只做 UI 层控制；资源是否存在、是否能访问，仍以后端返回 code/状态为准。',
    },
]
