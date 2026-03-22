import type { RouteRecordRaw } from 'vue-router'

import { ROUTE_NAME, ROUTE_PATH } from '@/shared/constants/routes'

export const creatorRoutes: RouteRecordRaw[] = [
    {
        path: ROUTE_PATH.ARTICLE_EDITOR_NEW,
        name: ROUTE_NAME.ARTICLE_EDITOR_NEW,
        component: () => import('@/pages/article/ArticleEditorPage.vue'),
        meta: {
            title: '\u65b0\u5efa\u6587\u7ae0',
            access: 'creator',
            requiresAuth: true,
            roles: ['USER', 'ADMIN'],
            presentation: 'sheet',
            sheetScroll: 'content',
        },
    },
    {
        path: ROUTE_PATH.ARTICLE_EDITOR,
        name: ROUTE_NAME.ARTICLE_EDITOR,
        component: () => import('@/pages/article/ArticleEditorPage.vue'),
        meta: {
            title: '\u7f16\u8f91\u6587\u7ae0',
            access: 'creator',
            requiresAuth: true,
            roles: ['USER', 'ADMIN'],
            presentation: 'sheet',
            sheetScroll: 'content',
        },
    },
]
