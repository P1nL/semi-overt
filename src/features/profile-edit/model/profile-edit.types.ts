import type { UpdateProfileReqDto } from '@/shared/types/api'
import type { UserProfileVm } from '@/entities/user'

export interface ProfileEditFormValues {
    nickname: string
    signature: string
    avatarUrl: string
    coverUrl: string
}

export type ProfileEditFieldErrors = Partial<Record<'nickname' | 'signature', string>>

export interface ProfileEditValidationResult {
    valid: boolean
    errors: ProfileEditFieldErrors
}

export type ProfileEditPayload = UpdateProfileReqDto

export interface ProfileEditResult {
    profile: UserProfileVm
}
