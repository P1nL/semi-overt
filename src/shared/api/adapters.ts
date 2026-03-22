import type {
    ArticleAuthorDto,
    ArticleCardDto,
    ArticleDetailRespDto,
    AuthRespDto,
    CategoryRespDto,
    HomeRespDto,
    PendingReviewListRespDto,
    ProfileDto,
    ReviewLogRespDto,
    SearchArticleRespDto,
    UserProfileRespDto,
} from '@/shared/types/api'
import { resolveAssetUrl } from '@/shared/utils/asset'

interface BackendAuthResp {
    token: string
    userId: number
    username: string
    nickname?: string | null
    email?: string | null
    role?: string | null
    avatarUrl?: string | null
}

interface BackendArticleCardResp {
    articleId: number
    title?: string | null
    summary?: string | null
    previewText?: string | null
    coverUrl?: string | null
    coverColor?: string | null
    readMinutes?: number | string | null
    durationCategory?: string | null
    status?: string | null
    authorId?: number | null
    authorName?: string | null
    authorAvatar?: string | null
    publishedAt?: string | null
    updatedAt?: string | null
    rejectReason?: string | null
}

interface BackendArticleDetailResp {
    id: number
    title?: string | null
    content: string
    summary?: string | null
    coverUrl?: string | null
    coverColor?: string | null
    wordCount?: number | null
    readMinutes?: number | string | null
    durationCategory?: string | null
    status: string
    author: {
        id?: number | null
        username?: string | null
        avatarUrl?: string | null
    }
    latestReviewReason?: string | null
    createdAt?: string | null
    updatedAt?: string | null
    publishedAt?: string | null
}

interface BackendUserInfoResp {
    userId: number
    username: string
    nickname?: string | null
    email?: string | null
    role?: string | null
    avatarUrl?: string | null
    coverUrl?: string | null
    signature?: string | null
    createdAt?: string | null
}

interface BackendUserProfileResp {
    profile: {
        id: number
        username: string
        nickname?: string | null
        avatarUrl?: string | null
        coverUrl?: string | null
        signature?: string | null
    }
    stats: {
        approved?: number
        pending?: number
        returned?: number
        rejected?: number
        draft?: number
        totalWordCount?: number
    }
    list: BackendArticleCardResp[]
    total?: number
    page?: number
    pageSize?: number
}

interface BackendHomeResp {
    hero: {
        primary: BackendArticleCardResp | null
        secondary: BackendArticleCardResp[]
    }
    sections: Array<{
        category: string
        list: BackendArticleCardResp[]
    }>
}

interface BackendCategoryResp {
    category: string
    list: BackendArticleCardResp[]
    total?: number
    page?: number
    pageSize?: number
    pages?: number
}

interface BackendSearchResp {
    keyword: string
    list: BackendArticleCardResp[]
    total?: number
    page?: number
    pageSize?: number
    pages?: number
}

interface BackendReviewPendingItemResp {
    id: number
    title: string
    submitCount: number
    submittedAt: string
    wordCount: number
    author: {
        id: number
        username: string
    }
}

interface BackendReviewPendingPageResp {
    records?: BackendReviewPendingItemResp[]
}

interface BackendReviewLogResp {
    action: string
    fromStatus: string
    toStatus: string
    reason?: string | null
    operator?: {
        id?: number | null
        username?: string | null
    } | null
    createdAt: string
}

function toNumber(value: number | string | null | undefined): number {
    if (typeof value === 'number') {
        return value
    }

    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) {
            return parsed
        }
    }

    return 0
}

function normalizeAuthor(raw: BackendArticleCardResp): ArticleAuthorDto | undefined {
    if (!raw.authorName && raw.authorId == null && !raw.authorAvatar) {
        return undefined
    }

    const username = raw.authorName?.trim() || 'user'

    return {
        id: raw.authorId ?? 0,
        username,
        nickname: username,
        avatarUrl: resolveAssetUrl(raw.authorAvatar),
    }
}

export function normalizeAuthResp(raw: BackendAuthResp): AuthRespDto {
    return {
        token: raw.token,
        user: {
            id: raw.userId,
            username: raw.username,
            email: raw.email ?? null,
            role: raw.role ?? 'USER',
            avatarUrl: resolveAssetUrl(raw.avatarUrl),
            nickname: raw.nickname ?? raw.username,
        },
    }
}

export function normalizeProfileDto(raw: BackendUserInfoResp): ProfileDto & {
    email?: string | null
    role?: string
} {
    return {
        id: raw.userId,
        username: raw.username,
        nickname: raw.nickname ?? raw.username,
        role: raw.role ?? 'USER',
        email: raw.email ?? null,
        avatarUrl: resolveAssetUrl(raw.avatarUrl),
        coverUrl: resolveAssetUrl(raw.coverUrl),
        signature: raw.signature ?? null,
    }
}

export function normalizeArticleCardDto(raw: BackendArticleCardResp): ArticleCardDto {
    return {
        id: raw.articleId,
        title: raw.title ?? null,
        summary: raw.summary ?? null,
        previewText: raw.previewText ?? null,
        coverUrl: resolveAssetUrl(raw.coverUrl),
        coverColor: raw.coverColor ?? null,
        readMinutes: toNumber(raw.readMinutes),
        durationCategory: raw.durationCategory ?? 'SHORT',
        status: raw.status ?? undefined,
        author: normalizeAuthor(raw),
        publishedAt: raw.publishedAt ?? null,
        updatedAt: raw.updatedAt ?? null,
        rejectReason: raw.rejectReason ?? null,
    }
}

export function normalizeArticleDetailDto(raw: BackendArticleDetailResp): ArticleDetailRespDto {
    return {
        id: raw.id,
        title: raw.title ?? null,
        content: raw.content,
        summary: raw.summary ?? null,
        coverUrl: raw.coverUrl ?? null,
        coverColor: raw.coverColor ?? null,
        wordCount: raw.wordCount ?? 0,
        readMinutes: toNumber(raw.readMinutes),
        durationCategory: raw.durationCategory ?? 'SHORT',
        status: raw.status,
        author: {
            id: raw.author?.id ?? 0,
            username: raw.author?.username ?? 'user',
            avatarUrl: resolveAssetUrl(raw.author?.avatarUrl),
        },
        latestReviewReason: raw.latestReviewReason ?? null,
        publishedAt: raw.publishedAt ?? null,
        updatedAt: raw.updatedAt ?? null,
    }
}

export function normalizeUserProfileResp(raw: BackendUserProfileResp): UserProfileRespDto {
    return {
        profile: {
            id: raw.profile.id,
            username: raw.profile.username,
            nickname: raw.profile.nickname ?? raw.profile.username,
            avatarUrl: resolveAssetUrl(raw.profile.avatarUrl),
            coverUrl: resolveAssetUrl(raw.profile.coverUrl),
            signature: raw.profile.signature ?? null,
            role: 'USER',
        },
        stats: {
            approved: raw.stats?.approved ?? 0,
            pending: raw.stats?.pending ?? 0,
            returned: raw.stats?.returned ?? 0,
            rejected: raw.stats?.rejected ?? 0,
            draft: raw.stats?.draft ?? 0,
            totalWordCount: raw.stats?.totalWordCount ?? 0,
        },
        list: raw.list.map(normalizeArticleCardDto),
        total: raw.total ?? raw.list.length,
        page: raw.page ?? 1,
        pageSize: raw.pageSize ?? 10,
    }
}

export function normalizeHomeResp(raw: BackendHomeResp): HomeRespDto {
    return {
        hero: {
            primary: raw.hero.primary ? normalizeArticleCardDto(raw.hero.primary) : null,
            secondary: raw.hero.secondary.map(normalizeArticleCardDto),
        },
        sections: raw.sections.map((section) => ({
            category: section.category,
            list: section.list.map(normalizeArticleCardDto),
        })),
    }
}

export function normalizeCategoryResp(raw: BackendCategoryResp): CategoryRespDto {
    return {
        category: raw.category,
        list: raw.list.map(normalizeArticleCardDto),
        total: raw.total ?? raw.list.length,
        page: raw.page ?? 1,
        pageSize: raw.pageSize ?? raw.list.length,
        pages: raw.pages ?? 1,
    }
}

export function normalizeSearchResp(raw: BackendSearchResp): SearchArticleRespDto {
    return {
        keyword: raw.keyword,
        list: raw.list.map(normalizeArticleCardDto),
        total: raw.total ?? raw.list.length,
        page: raw.page ?? 1,
        pageSize: raw.pageSize ?? raw.list.length,
        pages: raw.pages ?? 1,
    }
}

export function normalizePendingReviewListResp(
    raw: BackendReviewPendingPageResp,
): PendingReviewListRespDto {
    return {
        list: (raw.records ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            submitCount: item.submitCount,
            submittedAt: item.submittedAt,
            wordCount: item.wordCount,
            author: {
                id: item.author.id,
                username: item.author.username,
                nickname: item.author.username,
                avatarUrl: null,
            },
        })),
    }
}

export function normalizeReviewLogListResp(raw: BackendReviewLogResp[]): ReviewLogRespDto[] {
    return raw.map((item) => ({
        action: item.action,
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        reason: item.reason ?? null,
        operator: item.operator
            ? {
                id: item.operator.id ?? 0,
                username: item.operator.username ?? 'user',
                nickname: item.operator.username ?? 'user',
                avatarUrl: null,
            }
            : null,
        createdAt: item.createdAt,
    }))
}
