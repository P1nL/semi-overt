// src/entities/user/model/user.mapper.ts
import { mapArticleCardListDtoToVm } from '@/entities/article/model/article.mapper'
import type { UserProfileEntityDto, UserProfilePageEntityDto, UserProfileVm, UserRoleVm, UserStatItemVm } from './user.types'
import {
    USER_DEFAULT_SIGNATURE,
    USER_ROLE_BADGE_VARIANT_MAP,
    USER_ROLE_LABEL_MAP,
} from './user.constants'

function mapRole(role?: string | null): UserRoleVm | null {
    if (!role) return null
    const normalized = role.toUpperCase()
    const typed = normalized in USER_ROLE_LABEL_MAP ? (normalized as keyof typeof USER_ROLE_LABEL_MAP) : undefined

    return {
        value: normalized,
        label: typed ? USER_ROLE_LABEL_MAP[typed] : normalized,
        variant: typed ? USER_ROLE_BADGE_VARIANT_MAP[typed] : 'default',
    }
}

export function mapUserProfileDtoToVm(dto: UserProfileEntityDto): UserProfileVm {
    return {
        id: dto.id,
        username: dto.username,
        displayName: dto.nickname?.trim() || dto.username,
        avatarUrl: dto.avatarUrl ?? null,
        coverUrl: dto.coverUrl ?? null,
        signature: dto.signature?.trim() || USER_DEFAULT_SIGNATURE,
        role: mapRole(dto.role),
        profilePath: `/u/${encodeURIComponent(dto.username)}`,
        stats: [],
        total: 0,
        page: 1,
        pageSize: 10,
        articles: [],
    }
}

export function mapUserProfilePageDtoToVm(dto: UserProfilePageEntityDto): UserProfileVm {
    const base = mapUserProfileDtoToVm(dto.profile)
    const stats: UserStatItemVm[] = [
        { key: 'approved', label: '已发布', value: Number(dto.stats?.approved ?? 0) },
        { key: 'pending', label: '审核中', value: Number(dto.stats?.pending ?? 0) },
        { key: 'returned', label: '已退回', value: Number(dto.stats?.returned ?? 0) },
        { key: 'rejected', label: '已拒绝', value: Number(dto.stats?.rejected ?? 0) },
        { key: 'draft', label: '草稿', value: Number(dto.stats?.draft ?? 0) },
        { key: 'totalWordCount', label: '总字数', value: Number(dto.stats?.totalWordCount ?? 0) },
    ]

    return {
        ...base,
        stats,
        total: Number(dto.total ?? dto.list.length ?? 0),
        page: Number(dto.page ?? 1),
        pageSize: Number(dto.pageSize ?? 10),
        articles: mapArticleCardListDtoToVm(dto.list),
    }
}