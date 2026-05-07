import type {
    ArticleAuthorDto,
    ArticleCardDto,
    ArticleDetailRespDto,
    AuthRespDto,
    CategoryRespDto,
    HomeRespDto,
    PageRespDto,
    PendingReviewItemDto,
    ProfileDto,
    ReviewLogRespDto,
    SearchArticleRespDto,
    SearchUserRespDto,
    UserProfileRespDto,
    UserSearchItemDto,
} from '@/shared/types/api'
import { resolveAssetUrl } from '@/shared/utils/asset'

export interface BackendAuthResp {
    token: string
    userId: number
    username: string
    nickname?: string | null
    email?: string | null
    role?: string | null
    avatarUrl?: string | null
}

interface BackendArticleResp {
    id?: number
    articleId?: number
    authorId?: number | null
    title?: string | null
    content?: string | null
    summary?: string | null
    previewText?: string | null
    coverUrl?: string | null
    coverColor?: string | null
    readMinutes?: number | string | null
    durationCategory?: string | null
    status?: string | null
    wordCount?: number | null
    authorName?: string | null
    authorAvatar?: string | null
    submitCount?: number | null
    lastSubmittedAt?: string | null
    publishedAt?: string | null
    createdAt?: string | null
    updatedAt?: string | null
    rejectReason?: string | null
    latestReason?: string | null
    latestReviewReason?: string | null
    draftVisible?: boolean | null
    author?: {
        id?: number | null
        username?: string | null
        nickname?: string | null
        avatarUrl?: string | null
    } | null
}

export type BackendArticleCardResp = BackendArticleResp
export type BackendArticleDetailResp = BackendArticleResp & { id: number }

export interface BackendUserInfoResp {
    id?: number
    userId?: number
    username: string
    nickname?: string | null
    email?: string | null
    role?: string | null
    avatarUrl?: string | null
    coverUrl?: string | null
    signature?: string | null
    createdAt?: string | null
}

export interface BackendUserProfileResp {
    user?: BackendUserInfoResp
    profile?: BackendUserInfoResp
    stats?: Record<string, number | undefined>
    articles?: BackendArticleResp[]
    list?: BackendArticleResp[]
    total?: number
    page?: number
    pageSize?: number
    pages?: number
}

export interface BackendHomeResp {
    hero?: {
        primary: BackendArticleResp | null
        secondary: BackendArticleResp[]
    }
    sections: Array<{
        category?: string
        code?: string
        name?: string
        list?: BackendArticleResp[]
        articles?: BackendArticleResp[]
    }>
}

export interface BackendCategoryResp {
    category?: string
    code?: string
    list?: BackendArticleResp[]
    articles?: BackendArticleResp[]
    total?: number
    page?: number
    pageSize?: number
    pages?: number
}

export type BackendSearchResp = BackendArticleResp[] | {
    keyword: string
    list: BackendArticleResp[]
    total?: number
    page?: number
    pageSize?: number
    pages?: number
}

export interface BackendUserSearchItemResp {
    id: number
    username: string
    nickname?: string | null
    avatarUrl?: string | null
    profilePath?: string | null
}

export interface BackendUserSearchResp {
    keyword: string
    list: BackendUserSearchItemResp[]
    total?: number
    page?: number
    pageSize?: number
    pages?: number
}

interface BackendReviewPendingItemResp {
    id?: number
    articleId?: number
    authorId?: number
    title: string
    submitCount: number
    submittedAt: string
    wordCount: number
    status?: string
    author?: {
        id: number
        username: string
        nickname?: string | null
        avatarUrl?: string | null
    }
}

export type BackendReviewPendingPageResp = BackendReviewPendingItemResp[] | {
    list?: BackendReviewPendingItemResp[]
    records?: BackendReviewPendingItemResp[]
    total?: number
    page?: number
    pageSize?: number
    pages?: number
}

export interface BackendReviewLogResp {
    action: string
    fromStatus?: string
    toStatus?: string
    reason?: string | null
    operator?: {
        id?: number | null
        username?: string | null
        nickname?: string | null
        avatarUrl?: string | null
    } | null
    operatorId?: number | null
    createdAt: string
}

function toNumber(value: number | string | null | undefined): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return 0
}

function getArticleId(raw: BackendArticleResp): number {
    return raw.id ?? raw.articleId ?? 0
}

function getAuthorId(raw: BackendArticleResp): number {
    return raw.author?.id ?? raw.authorId ?? 0
}

function getAuthorUsername(raw: BackendArticleResp): string {
    const authorId = getAuthorId(raw)
    return raw.author?.username ?? raw.authorName?.trim() ?? String(authorId || 'user')
}

function normalizeAuthor(raw: BackendArticleResp): ArticleAuthorDto | undefined {
    const authorId = getAuthorId(raw)
    if (!authorId && !raw.authorName && !raw.author?.username && !raw.authorAvatar && !raw.author?.avatarUrl) {
        return undefined
    }

    const username = getAuthorUsername(raw)
    return {
        id: authorId,
        username,
        nickname: raw.author?.nickname ?? username,
        avatarUrl: resolveAssetUrl(raw.author?.avatarUrl ?? raw.authorAvatar),
    }
}

function normalizeArticleCardDto(raw: BackendArticleResp): ArticleCardDto & { draftVisible: boolean } {
    const status = raw.status ?? undefined
    return {
        id: getArticleId(raw),
        title: raw.title ?? null,
        summary: raw.summary ?? null,
        previewText: raw.previewText ?? raw.content ?? null,
        coverUrl: resolveAssetUrl(raw.coverUrl),
        coverColor: raw.coverColor ?? null,
        readMinutes: toNumber(raw.readMinutes),
        durationCategory: raw.durationCategory ?? 'SHORT',
        wordCount: raw.wordCount ?? undefined,
        status,
        author: normalizeAuthor(raw),
        publishedAt: raw.publishedAt ?? (status === 'APPROVED' ? raw.updatedAt ?? raw.createdAt ?? null : null),
        updatedAt: raw.updatedAt ?? null,
        rejectReason: raw.rejectReason ?? null,
        draftVisible: raw.draftVisible ?? false,
    }
}

function isPublicListArticle(raw: BackendArticleResp): boolean {
    const status = raw.status?.toUpperCase?.()
    return !status || status === 'APPROVED'
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
        id: raw.userId ?? raw.id ?? 0,
        username: raw.username,
        nickname: raw.nickname ?? raw.username,
        role: raw.role ?? 'USER',
        email: raw.email ?? null,
        avatarUrl: resolveAssetUrl(raw.avatarUrl),
        coverUrl: resolveAssetUrl(raw.coverUrl),
        signature: raw.signature ?? null,
    }
}

export function normalizeArticleDetailDto(raw: BackendArticleDetailResp): ArticleDetailRespDto & { draftVisible: boolean } {
    return {
        id: getArticleId(raw),
        title: raw.title ?? null,
        content: raw.content ?? '',
        summary: raw.summary ?? null,
        coverUrl: resolveAssetUrl(raw.coverUrl),
        coverColor: raw.coverColor ?? null,
        wordCount: raw.wordCount ?? 0,
        readMinutes: toNumber(raw.readMinutes),
        durationCategory: raw.durationCategory ?? 'SHORT',
        status: raw.status ?? 'DRAFT',
        author: normalizeAuthor(raw) ?? {
            id: getAuthorId(raw),
            username: getAuthorUsername(raw),
            nickname: getAuthorUsername(raw),
            avatarUrl: null,
        },
        latestReviewReason: raw.latestReviewReason ?? raw.rejectReason ?? null,
        submitCount: raw.submitCount ?? 0,
        lastSubmittedAt: raw.lastSubmittedAt ?? null,
        publishedAt: raw.publishedAt ?? null,
        updatedAt: raw.updatedAt ?? null,
        draftVisible: raw.draftVisible ?? false,
    }
}

export function normalizeUserProfileResp(raw: BackendUserProfileResp): UserProfileRespDto {
    const profile = raw.profile ?? raw.user
    const list = raw.list ?? raw.articles ?? []
    return {
        profile: normalizeProfileDto(profile ?? { id: 0, username: 'user' }),
        stats: {
            approved: raw.stats?.approved ?? 0,
            pending: raw.stats?.pending ?? 0,
            returned: raw.stats?.returned ?? 0,
            rejected: raw.stats?.rejected ?? 0,
            draft: raw.stats?.draft ?? 0,
            totalWordCount: raw.stats?.totalWordCount ?? 0,
        },
        list: list.map(normalizeArticleCardDto),
        total: raw.total ?? list.length,
        page: raw.page ?? 1,
        pageSize: raw.pageSize ?? 10,
        pages: raw.pages ?? 1,
    }
}

export function normalizeHomeResp(raw: BackendHomeResp): HomeRespDto {
    const sections = raw.sections.map((section) => ({
        category: section.category ?? section.code ?? 'SHORT',
        list: (section.list ?? section.articles ?? []).filter(isPublicListArticle).map(normalizeArticleCardDto),
    }))
    const fallbackArticles = sections.flatMap((section) => section.list)
    const primary = raw.hero?.primary && isPublicListArticle(raw.hero.primary) ? normalizeArticleCardDto(raw.hero.primary) : fallbackArticles[0] ?? null
    const seenHeroIds = new Set<number>()
    const secondaryCandidates = [
        ...(raw.hero?.secondary ? raw.hero.secondary.filter(isPublicListArticle).map(normalizeArticleCardDto) : []),
        ...fallbackArticles,
    ]

    if (primary) {
        seenHeroIds.add(primary.id)
    }

    return {
        hero: {
            primary,
            secondary: secondaryCandidates
                .filter((article) => {
                    if (seenHeroIds.has(article.id)) return false
                    seenHeroIds.add(article.id)
                    return true
                })
                .slice(0, 10),
        },
        sections,
    }
}

export function normalizeCategoryResp(raw: BackendCategoryResp): CategoryRespDto {
    const list = (raw.list ?? raw.articles ?? []).filter(isPublicListArticle)
    return {
        category: raw.category ?? raw.code ?? 'SHORT',
        list: list.map(normalizeArticleCardDto),
        total: raw.total ?? list.length,
        page: raw.page ?? 1,
        pageSize: raw.pageSize ?? list.length,
        pages: raw.pages ?? 1,
    }
}

export function normalizeSearchResp(raw: BackendSearchResp): SearchArticleRespDto {
    const list = (Array.isArray(raw) ? raw : raw.list).filter(isPublicListArticle)
    return {
        keyword: Array.isArray(raw) ? '' : raw.keyword,
        list: list.map(normalizeArticleCardDto),
        total: Array.isArray(raw) ? list.length : raw.total ?? list.length,
        page: Array.isArray(raw) ? 1 : raw.page ?? 1,
        pageSize: Array.isArray(raw) ? list.length : raw.pageSize ?? list.length,
        pages: Array.isArray(raw) ? 1 : raw.pages ?? 1,
    }
}

export function normalizeUserSearchResp(raw: BackendUserSearchResp): SearchUserRespDto {
    const list: UserSearchItemDto[] = (raw.list ?? []).map((item) => ({
        id: item.id,
        username: item.username,
        nickname: item.nickname?.trim() || null,
        avatarUrl: resolveAssetUrl(item.avatarUrl),
        profilePath: item.profilePath?.trim() || `/u/${encodeURIComponent(String(item.id))}`,
    }))

    return {
        keyword: raw.keyword,
        list,
        total: Number(raw.total ?? list.length),
        page: Number(raw.page ?? 1),
        pageSize: Number(raw.pageSize ?? (list.length || 10)),
        pages: Number(raw.pages ?? (list.length > 0 ? 1 : 0)),
    }
}

export function normalizePendingReviewListResp(
    raw: BackendReviewPendingPageResp,
): PageRespDto<PendingReviewItemDto> {
    const records = Array.isArray(raw) ? raw : raw.list ?? raw.records ?? []
    return {
        list: records.map((item) => {
            const authorId = item.author?.id ?? item.authorId ?? 0
            const username = item.author?.username ?? String(authorId || 'user')
            return {
                id: item.id ?? item.articleId ?? 0,
                title: item.title,
                submitCount: item.submitCount,
                submittedAt: item.submittedAt,
                wordCount: item.wordCount,
                author: {
                    id: authorId,
                    username,
                    nickname: item.author?.nickname ?? username,
                    avatarUrl: resolveAssetUrl(item.author?.avatarUrl),
                },
            }
        }),
        total: Array.isArray(raw) ? records.length : raw.total ?? records.length,
        page: Array.isArray(raw) ? 1 : raw.page ?? 1,
        pageSize: Array.isArray(raw) ? records.length : raw.pageSize ?? records.length,
        pages: Array.isArray(raw) ? 1 : raw.pages ?? 1,
    }
}

export function normalizeReviewLogListResp(raw: BackendReviewLogResp[]): ReviewLogRespDto[] {
    return raw.map((item) => ({
        action: item.action,
        fromStatus: item.fromStatus ?? 'PENDING',
        toStatus: item.toStatus ?? item.action,
        reason: item.reason ?? null,
        operator: item.operator
            ? {
                id: item.operator.id ?? 0,
                username: item.operator.username ?? 'user',
                nickname: item.operator.nickname ?? item.operator.username ?? 'user',
                avatarUrl: resolveAssetUrl(item.operator.avatarUrl),
            }
            : item.operatorId != null
                ? {
                    id: item.operatorId,
                    username: String(item.operatorId),
                    nickname: String(item.operatorId),
                    avatarUrl: null,
                }
                : null,
        createdAt: item.createdAt,
    }))
}

export { normalizeArticleCardDto }
