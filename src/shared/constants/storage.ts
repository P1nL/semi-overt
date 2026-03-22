export const STORAGE_KEY = {
    ACCESS_TOKEN: 'now.accessToken',
    AUTH_USER: 'now.authUser',
    DARK_MODE: 'now.darkMode',
    SEARCH_QUERY: 'now.searchQuery',
    AUTH_REDIRECT: 'now.authRedirect',
    ARTICLE_PUBLISH_COOLDOWN_PREFIX: 'now.articlePublishCooldown.',
} as const

export const SESSION_STORAGE_KEY = {
    EDITOR_DRAFT_PREFIX: 'now.editorDraft.',
} as const
