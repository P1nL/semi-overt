import {
    createRouter,
    createWebHistory,
    type RouteRecordRaw,
} from 'vue-router'

import { setupRouterGuards } from '@/app/router/guards'
import { adminRoutes } from '@/app/router/routes/admin'
import { creatorRoutes } from '@/app/router/routes/creator'
import { publicRoutes } from '@/app/router/routes/public'
import { ENV } from '@/shared/config/env'

export type AppUserRole = 'USER' | 'ADMIN'
export type AppRouteAccess = 'public' | 'creator' | 'admin'



declare module 'vue-router' {
    interface RouteMeta {
        title?: string
        access?: AppRouteAccess
        requiresAuth?: boolean
        publicOnly?: boolean
        roles?: AppUserRole[]
        drawerAware?: boolean
        presentation?: 'sheet'
        sheetVariant?: 'default' | 'full'
        sheetInset?: 'default' | 'article'
        sheetScroll?: 'sheet' | 'content'
    }
}

const routes: RouteRecordRaw[] = [
    ...publicRoutes,
    ...creatorRoutes,
    ...adminRoutes,
]

export function createAppRouter() {
    const router = createRouter({
        history: createWebHistory(ENV.routerBase),
        routes,
        scrollBehavior(to, from, savedPosition) {
            // Sheet 页面始终叠加在仍然挂载的背景页之上。打开或关闭 Sheet 时
            // 不需要重新应用 history.savedPosition，否则会产生一次可见的滚动定位。
            if (to.meta.presentation === 'sheet' || from.meta.presentation === 'sheet') {
                return false
            }

            if (savedPosition) return savedPosition
            if (to.hash) {
                return {
                    el: to.hash,
                    top: 88,
                    behavior: 'smooth',
                }
            }
            if (to.path !== from.path) {
                return { top: 0 }
            }
            return undefined
        },
    })

    setupRouterGuards(router)

    return router
}
