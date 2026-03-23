import type { AuthUser } from '@/stores/auth'

export interface LoginFormValues {
    account: string
    password: string
    rememberMe: boolean
}

export interface RegisterFormValues {
    email: string
    username: string
    password: string
    confirmPassword: string
}

export interface ForgotPasswordFormValues {
    email: string
}

export interface ResetPasswordFormValues {
    token: string
    newPassword: string
    confirmPassword: string
}

export type AuthFieldErrors<T> = Partial<Record<keyof T, string>>

export interface AuthSessionVm {
    token: string
    user: AuthUser
}
