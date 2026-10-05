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
import { beginPageScrollTransition, cancelPageScrollTransition, getPageScrollPosition, requestPageScroll, type PageScrollPosition } from '@/shared/utils/pageScroll'

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
        sheetInset?: 'default' | 'article' | 'editor'
        sheetScroll?: 'sheet' | 'content'
    }
}

const routes: RouteRecordRaw[] = [
    ...publicRoutes,
    ...creatorRoutes,
    ...adminRoutes,
]

export function createAppRouter() {
    const pagePositions = new Map<string, PageScrollPosition>()
    let sheetBackgroundPath: string | null = null
    const router = createRouter({
        history: createWebHistory(ENV.routerBase),
        routes,
        scrollBehavior(to, from, savedPosition) {
            // Sheet navigation keeps the underlying container at its current position.
            if (to.meta.presentation === 'sheet') return false
            if (from.meta.presentation === 'sheet') {
                if (to.fullPath === sheetBackgroundPath) {
                    sheetBackgroundPath = null
                    return false
                }
                // A different page is not the preserved sheet background. Wait for
                // the base view to change after the sheet's closing transition.
                beginPageScrollTransition()
                sheetBackgroundPath = null
            }
            if (savedPosition) {
                requestPageScroll(pagePositions.get(to.fullPath) ?? savedPosition)
            } else if (to.hash) {
                requestPageScroll({ hash: to.hash, behavior: 'smooth' })
            } else if (to.path !== from.path) {
                requestPageScroll({ top: 0, left: 0 })
            }
            // The browser viewport never scrolls; requests target the app container.
            return false
        },
    })

    router.beforeEach((to, from) => {
        if (from.meta.presentation !== 'sheet') {
            pagePositions.set(from.fullPath, getPageScrollPosition())
            if (to.meta.presentation === 'sheet') sheetBackgroundPath = from.fullPath
        }
    })
    router.afterEach((_to, _from, failure) => {
        if (failure) cancelPageScrollTransition()
    })

    setupRouterGuards(router)

    return router
}
