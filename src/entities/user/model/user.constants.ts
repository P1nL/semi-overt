// src/entities/user/model/user.constants.ts
export const USER_ROLE = {
    USER: 'USER',
    ADMIN: 'ADMIN',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export const USER_ROLE_LABEL_MAP: Record<UserRole, string> = {
    USER: '用户',
    ADMIN: '管理员',
}

export const USER_ROLE_BADGE_VARIANT_MAP: Record<
    UserRole,
    'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
> = {
    USER: 'default',
    ADMIN: 'primary',
}

export const USER_DEFAULT_SIGNATURE = '这个人很低调，还没有留下签名。'
