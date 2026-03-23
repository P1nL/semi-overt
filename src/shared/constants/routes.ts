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
