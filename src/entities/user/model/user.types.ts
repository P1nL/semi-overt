// src/entities/user/model/user.types.ts
import type { ProfileDto, UserProfileRespDto } from '@/shared/types/api'
import type { UserRole } from './user.constants'
import type { ArticleCardEntityDto, ArticleCardVm } from '@/entities/article/model/article.types'

export interface UserProfileEntityDto extends ProfileDto {
    nickname?: string | null
    email?: string | null
    role?: UserRole | string
}

export interface UserProfilePageEntityDto extends Omit<UserProfileRespDto, 'profile' | 'list' | 'stats'> {
    profile: UserProfileEntityDto
    stats: Record<string, number> & {
        approved?: number
        pending?: number
        returned?: number
        rejected?: number
        draft?: number
        totalWordCount?: number
    }
    list: ArticleCardEntityDto[]
    total?: number
    page?: number
    pageSize?: number
}

export interface UserRoleVm {
    value: UserRole | string
    label: string
    variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

export interface UserStatItemVm {
    key: string
    label: string
    value: number
}

export interface UserProfileVm {
    id: number
    username: string
    displayName: string
    avatarUrl: string | null
    coverUrl: string | null
    signature: string
    role: UserRoleVm | null
    profilePath: string
    stats: UserStatItemVm[]
    total: number
    page: number
    pageSize: number
    articles: ArticleCardVm[]
}