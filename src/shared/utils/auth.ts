import {
    AUTH_HEADER,
    EMAIL_RULE,
    PASSWORD_RULE,
    USERNAME_RULE,
    USER_ROLE,
    type UserRole,
} from '@/shared/constants/auth'

export function isValidEmail(value?: string | null): boolean {
    if (!value) return false
    return EMAIL_RULE.PATTERN.test(value.trim())
}

export function isValidUsername(value?: string | null): boolean {
    if (!value) return false
    const text = value.trim()
    return USERNAME_RULE.PATTERN.test(text) && !USERNAME_RULE.PURE_NUMBER_PATTERN.test(text)
}

export function isValidPassword(value?: string | null): boolean {
    if (!value) return false
    const text = value.trim()
    const hasLetter = /[A-Za-z]/.test(text)
    const hasNumber = /\d/.test(text)

    return text.length >= PASSWORD_RULE.MIN_LENGTH && hasLetter && hasNumber
}

export function isAdminRole(role?: string | null): boolean {
    return role === USER_ROLE.ADMIN
}

export function isUserRole(role?: string | null): role is UserRole {
    return role === USER_ROLE.USER || role === USER_ROLE.ADMIN
}

export function withBearerToken(token?: string | null): string {
    if (!token) return ''
    return token.startsWith(AUTH_HEADER.BEARER_PREFIX)
        ? token
        : `${AUTH_HEADER.BEARER_PREFIX}${token}`
}

export function stripBearerToken(value?: string | null): string {
    if (!value) return ''
    return value.startsWith(AUTH_HEADER.BEARER_PREFIX)
        ? value.slice(AUTH_HEADER.BEARER_PREFIX.length)
        : value
}

export function buildAuthHeader(token?: string | null): Record<string, string> {
    const normalized = stripBearerToken(token)

    if (!normalized) {
        return {}
    }

    return {
        [AUTH_HEADER.AUTHORIZATION]: withBearerToken(normalized),
    }
}