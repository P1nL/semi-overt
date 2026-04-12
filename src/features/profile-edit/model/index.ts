import { mapUserProfileDtoToVm } from '@/entities/user'
import type { UserProfileVm } from '@/entities/user'
import { queryKeys } from '@/shared/api/queryKeys'
import { queryClient } from '@/shared/lib/queryClient'
import type { ProfileDto } from '@/shared/types/api'
import type { useAuthStore } from '@/stores/auth'
import type {
    ProfileEditFormValues,
    ProfileEditPayload,
    ProfileEditValidationResult,
} from './profile-edit.types'

type AuthStore = ReturnType<typeof useAuthStore>

const NICKNAME_MIN_LENGTH = 1
const NICKNAME_MAX_LENGTH = 30
const SIGNATURE_MAX_LENGTH = 50

export function createProfileEditFormValues(profile?: UserProfileVm | null): ProfileEditFormValues {
    return {
        nickname: profile?.displayName || '',
        signature: profile?.signature || '',
        avatarUrl: profile?.avatarUrl || '',
        coverUrl: profile?.coverUrl || '',
    }
}

export function mapProfileEditFormToPayload(values: ProfileEditFormValues): ProfileEditPayload {
    return {
        nickname: values.nickname.trim(),
        signature: values.signature.trim(),
        avatarUrl: values.avatarUrl.trim() || undefined,
        coverUrl: values.coverUrl.trim() || undefined,
    }
}

export function validateProfileEditForm(values: ProfileEditFormValues): ProfileEditValidationResult {
    const errors: ProfileEditValidationResult['errors'] = {}
    const nickname = values.nickname.trim()

    if (!nickname) {
        errors.nickname = '昵称不能为空'
    } else if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) {
        errors.nickname = `昵称长度需为 ${NICKNAME_MIN_LENGTH}-${NICKNAME_MAX_LENGTH} 字`
    }

    if (values.signature.length > SIGNATURE_MAX_LENGTH) {
        errors.signature = `签名最多 ${SIGNATURE_MAX_LENGTH} 字`
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    }
}

export function applyProfileUpdate(dto: ProfileDto, authStore: AuthStore): void {
    const next = mapUserProfileDtoToVm(dto)

    authStore.patchUser({
        username: next.username,
        nickname: next.displayName,
        avatar: next.avatarUrl,
    })

    void queryClient.invalidateQueries({
        queryKey: [queryKeys.userProfile('', '', 0, 0)[0]],
    })
}

export type {
    ProfileEditFieldErrors,
    ProfileEditFormValues,
    ProfileEditPayload,
    ProfileEditResult,
    ProfileEditValidationResult,
} from './profile-edit.types'
