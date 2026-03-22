export const ROUTE_NAME = {
    HOME: 'home',
    LOGIN: 'login',
    REGISTER: 'register',
    FORGOT_PASSWORD: 'forgot-password',
    RESET_PASSWORD: 'reset-password',

    CATEGORY: 'category',
    SEARCH: 'search',

    ARTICLE_READ: 'article-read',
    ARTICLE_EDITOR: 'article-editor',
    ARTICLE_EDITOR_NEW: 'article-editor-new',
    ARTICLE_REVIEW: 'article-review',

    PROFILE: 'profile',
    REVIEW_DASHBOARD: 'review-dashboard',

    FORBIDDEN: 'forbidden',
    NOT_FOUND: 'not-found',
} as const

export type RouteName = (typeof ROUTE_NAME)[keyof typeof ROUTE_NAME]

export const ROUTE_PATH = {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',

    CATEGORY: '/category/:tab?',
    SEARCH: '/search',

    ARTICLE_READ: '/articles/:id',
    ARTICLE_EDITOR_NEW: '/article-editor-new',
    ARTICLE_EDITOR: '/editor/:id',
    ARTICLE_REVIEW: '/review/articles/:id',

    PROFILE: '/u/:username',
    REVIEW_DASHBOARD: '/review',

    FORBIDDEN: '/403',
    NOT_FOUND: '/:pathMatch(.*)*',
} as const

export const ROUTE_META_KEY = {
    REQUIRES_AUTH: 'requiresAuth',
    REQUIRES_GUEST: 'requiresGuest',
    REQUIRES_ADMIN: 'requiresAdmin',
    TITLE: 'title',
} as const

export const PUBLIC_ROUTE_NAMES: readonly RouteName[] = [
    ROUTE_NAME.HOME,
    ROUTE_NAME.LOGIN,
    ROUTE_NAME.REGISTER,
    ROUTE_NAME.FORGOT_PASSWORD,
    ROUTE_NAME.RESET_PASSWORD,
    ROUTE_NAME.CATEGORY,
    ROUTE_NAME.SEARCH,
    ROUTE_NAME.ARTICLE_READ,
    ROUTE_NAME.PROFILE,
    ROUTE_NAME.NOT_FOUND,
]

export const AUTH_ROUTE_NAMES: readonly RouteName[] = [
    ROUTE_NAME.LOGIN,
    ROUTE_NAME.REGISTER,
    ROUTE_NAME.FORGOT_PASSWORD,
    ROUTE_NAME.RESET_PASSWORD,
]