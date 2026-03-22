import type { RouteRecordRaw } from 'vue-router'

import { ROUTE_NAME, ROUTE_PATH } from '@/shared/constants/routes'

export const publicRoutes: RouteRecordRaw[] = [
  {
    path: ROUTE_PATH.HOME,
    name: ROUTE_NAME.HOME,
    component: () => import('@/pages/home/HomePage.vue'),
    meta: {
      title: '\u9996\u9875',
      access: 'public',
    },
  },
  {
    path: '/',
    component: () => import('@/pages/auth/AuthPageShell.vue'),
    children: [
      {
        path: ROUTE_PATH.LOGIN,
        name: ROUTE_NAME.LOGIN,
        component: () => import('@/pages/auth/LoginPage.vue'),
        meta: {
          title: '\u767b\u5f55',
          access: 'public',
          publicOnly: true,
        },
      },
      {
        path: ROUTE_PATH.REGISTER,
        name: ROUTE_NAME.REGISTER,
        component: () => import('@/pages/auth/RegisterPage.vue'),
        meta: {
          title: '\u6ce8\u518c',
          access: 'public',
          publicOnly: true,
        },
      },
      {
        path: ROUTE_PATH.FORGOT_PASSWORD,
        name: ROUTE_NAME.FORGOT_PASSWORD,
        component: () => import('@/pages/auth/ForgotPasswordPage.vue'),
        meta: {
          title: '\u627e\u56de\u5bc6\u7801',
          access: 'public',
          publicOnly: true,
        },
      },
      {
        path: ROUTE_PATH.RESET_PASSWORD,
        name: ROUTE_NAME.RESET_PASSWORD,
        component: () => import('@/pages/auth/ResetPasswordPage.vue'),
        meta: {
          title: '\u91cd\u7f6e\u5bc6\u7801',
          access: 'public',
          publicOnly: true,
        },
      },
    ],
  },
  {
    path: ROUTE_PATH.SEARCH,
    name: ROUTE_NAME.SEARCH,
    component: () => import('@/pages/search/SearchPage.vue'),
    meta: {
      title: '\u641c\u7d22',
      access: 'public',
    },
  },
  {
    path: ROUTE_PATH.CATEGORY,
    name: ROUTE_NAME.CATEGORY,
    component: () => import('@/pages/category/CategoryPage.vue'),
    meta: {
      title: '\u5206\u7c7b',
      access: 'public',
    },
  },
  {
    path: ROUTE_PATH.ARTICLE_READ,
    name: ROUTE_NAME.ARTICLE_READ,
    component: () => import('@/pages/article/ArticleReadPage.vue'),
    meta: {
      title: '\u6587\u7ae0\u8be6\u60c5',
      access: 'public',
      presentation: 'sheet',
      sheetInset: 'article',
      sheetScroll: 'content',
    },
  },
  {
    path: ROUTE_PATH.PROFILE,
    name: ROUTE_NAME.PROFILE,
    component: () => import('@/pages/profile/ProfilePage.vue'),
    meta: {
      title: '\u4e2a\u4eba\u4e3b\u9875',
      access: 'public',
    },
  },
  {
    path: ROUTE_PATH.FORBIDDEN,
    name: ROUTE_NAME.FORBIDDEN,
    component: () => import('@/pages/system/ForbiddenPage.vue'),
    meta: {
      title: '\u65e0\u6743\u9650\u8bbf\u95ee',
      access: 'public',
      drawerAware: false,
    },
  },
  {
    path: ROUTE_PATH.NOT_FOUND,
    name: ROUTE_NAME.NOT_FOUND,
    component: () => import('@/pages/system/NotFoundPage.vue'),
    meta: {
      title: '\u9875\u9762\u4e0d\u5b58\u5728',
      access: 'public',
      drawerAware: false,
    },
  },
]
