import type {
    ForgotPasswordReqDto,
    LoginReqDto,
    RegisterReqDto,
    ResetPasswordReqDto,
} from '@/shared/types/api'
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

export interface AuthSubmitResult {
    ok: boolean
    message?: string
}

export interface AuthSessionVm {
    token: string
    user: AuthUser
}

export type LoginPayload = LoginReqDto
export type RegisterPayload = RegisterReqDto
export type ForgotPasswordPayload = ForgotPasswordReqDto
export type ResetPasswordPayload = ResetPasswordReqDto