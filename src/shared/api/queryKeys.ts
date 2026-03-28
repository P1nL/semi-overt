export const queryKeys = {
    home: ['home'] as const,
    category: (category: string, page: number, pageSize: number) =>
        ['category', category, page, pageSize] as const,
    search: (keyword: string, page: number, pageSize: number) =>
        ['search', keyword, page, pageSize] as const,
    articleDetail: (articleId: number | string) => ['article', articleId] as const,
    userProfile: (username: string, tab: string, page: number, pageSize: number) =>
        ['user-profile', username, tab, page, pageSize] as const,
    reviewPending: (page: number, pageSize: number) =>
        ['review-pending', page, pageSize] as const,
    reviewPendingRoot: ['review-pending'] as const,
    reviewLogs: (articleId: number | string) => ['review-logs', articleId] as const,
} as const
