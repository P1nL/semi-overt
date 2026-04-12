// src/entities/user — 顶级 barrel
// model 层
export {
    USER_ROLE,
    USER_ROLE_LABEL_MAP,
    USER_ROLE_BADGE_VARIANT_MAP,
    USER_DEFAULT_SIGNATURE,
} from './model/user.constants'

export type { UserRole } from './model/user.constants'

export {
    mapUserProfileDtoToVm,
    mapUserProfilePageDtoToVm,
} from './model/user.mapper'

export type {
    UserProfileEntityDto,
    UserProfilePageEntityDto,
    UserRoleVm,
    UserStatItemVm,
    UserProfileVm,
} from './model/user.types'

// ui 层
export { UserRoleBadge } from './ui'
