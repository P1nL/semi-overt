import type { RouteRecordRaw } from 'vue-router'

import { ROUTE_NAME, ROUTE_PATH } from '@/shared/constants/routes'

export const adminRoutes: RouteRecordRaw[] = [
    {
        path: ROUTE_PATH.REVIEW_DASHBOARD,
        name: ROUTE_NAME.REVIEW_DASHBOARD,
        component: () => import('@/pages/review/ReviewDashboardPage.vue'),
        meta: {
            title: '审核台',
            access: 'admin',
            requiresAuth: true,
            roles: ['ADMIN'],
        },
    },
    {
        path: ROUTE_PATH.ARTICLE_REVIEW,
        name: ROUTE_NAME.ARTICLE_REVIEW,
        component: () => import('@/pages/article/ArticleReviewPage.vue'),
        meta: {
            title: '文章审核',
            access: 'admin',
            requiresAuth: true,
            roles: ['ADMIN'],
            presentation: 'sheet',
        },
    },
]
