import type { AuthRespDto } from '@/shared/types/api'
import type {
    ForgotPasswordFormValues,
    LoginFormValues,
    RegisterFormValues,
    ResetPasswordFormValues,
    AuthSessionVm,
} from './auth.types'

export function mapLoginFormToDto(values: LoginFormValues) {
    return {
        account: values.account.trim(),
        password: values.password,
        rememberMe: values.rememberMe,
    }
}

export function mapRegisterFormToDto(values: RegisterFormValues) {
    return {
        email: values.email.trim(),
        username: values.username.trim(),
        password: values.password,
    }
}

export function mapForgotPasswordFormToDto(values: ForgotPasswordFormValues) {
    return {
        email: values.email.trim(),
    }
}

export function mapResetPasswordFormToDto(values: ResetPasswordFormValues) {
    return {
        token: values.token.trim(),
        newPassword: values.newPassword,
    }
}

export function mapAuthRespToSession(dto: AuthRespDto): AuthSessionVm {
    return {
        token: dto.token,
        user: {
            id: dto.user.id,
            username: dto.user.username,
            nickname: dto.user.nickname ?? dto.user.username,
            avatar: dto.user.avatarUrl ?? null,
            role: dto.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
        },
    }
}
