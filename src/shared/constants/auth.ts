export const USER_ROLE = {
    USER: 'USER',
    ADMIN: 'ADMIN',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export const USER_ROLE_LABEL_MAP: Record<UserRole, string> = {
    USER: '用户',
    ADMIN: '管理员',
}

export const AUTH_BIZ_CODE = {
    SUCCESS: 200,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    SERVER_ERROR: 500,
} as const

export const AUTH_HEADER = {
    AUTHORIZATION: 'Authorization',
    BEARER_PREFIX: 'Bearer ',
    REFRESH_TOKEN_HEADER: 'x-refresh-token',
} as const

export const PASSWORD_RULE = {
    MIN_LENGTH: 8,
} as const

export const USERNAME_RULE = {
    MIN_LENGTH: 4,
    MAX_LENGTH: 20,
    PATTERN: /^[A-Za-z0-9_]{4,20}$/,
    PURE_NUMBER_PATTERN: /^\d+$/,
} as const

export const EMAIL_RULE = {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const