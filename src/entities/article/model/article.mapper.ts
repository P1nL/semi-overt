import type {
    ArticleAuthorEntityDto,
    ArticleAuthorVm,
    ArticleCardEntityDto,
    ArticleCardVm,
    ArticleCoverVm,
    ArticleDetailEntityDto,
    ArticleDetailVm,
    ArticleDraftEntityDto,
    ArticleDraftVm,
    ArticleMetaVm,
    ArticleStatusVm,
    ArticleSummaryVm,
} from './article.types'
import {
    ARTICLE_DEFAULT_AUTHOR_NAME,
    ARTICLE_DEFAULT_COVER_COLOR,
    ARTICLE_DEFAULT_TITLE,
    ARTICLE_DURATION_CATEGORY,
    ARTICLE_DURATION_LABEL_MAP,
    ARTICLE_STATUS,
    ARTICLE_STATUS_BADGE_VARIANT_MAP,
    ARTICLE_STATUS_LABEL_MAP,
    ARTICLE_WORDS_PER_MINUTE,
} from './article.constants'

function toDisplayDate(value?: string | null): string | null {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}

function getInitials(name?: string | null): string {
    const source = (name ?? '').trim()
    return source ? source.slice(0, 1).toUpperCase() : 'U'
}

function normalizeStatus(status?: string | null): string {
    return status?.toUpperCase() || ARTICLE_STATUS.DRAFT
}

function normalizeDuration(category?: string | null): string {
    return category?.toUpperCase() || ARTICLE_DURATION_CATEGORY.SHORT
}

function normalizeReadMinutes(value?: number | null, wordCount?: number | null): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Number(value.toFixed(1))
    }

    if (typeof wordCount === 'number' && wordCount > 0) {
        return Number((wordCount / ARTICLE_WORDS_PER_MINUTE).toFixed(1))
    }

    return 0
}

function formatReadMinutes(value: number): string {
    if (value <= 0) return '约 1 分钟'
    const rounded = value < 1 ? 1 : Math.round(value)
    return `约 ${rounded} 分钟`
}

function formatWordCount(value?: number | null): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
    return `${value} 字`
}

function createArticleStatusVm(status?: string | null): ArticleStatusVm {
    const normalized = normalizeStatus(status)
    const typedStatus =
        normalized in ARTICLE_STATUS_LABEL_MAP ? (normalized as keyof typeof ARTICLE_STATUS_LABEL_MAP) : undefined

    return {
        value: normalized,
        label: typedStatus ? ARTICLE_STATUS_LABEL_MAP[typedStatus] : normalized,
        variant: typedStatus ? ARTICLE_STATUS_BADGE_VARIANT_MAP[typedStatus] : 'default',
    }
}

function createArticleAuthorVm(author?: ArticleAuthorEntityDto | null): ArticleAuthorVm | null {
    if (!author) return null

    const displayName = author.nickname?.trim() || author.username || ARTICLE_DEFAULT_AUTHOR_NAME

    return {
        id: author.id,
        username: author.username,
        displayName,
        avatarUrl: author.avatarUrl ?? null,
        initials: getInitials(displayName),
        profilePath: `/u/${encodeURIComponent(author.username)}`,
    }
}

function createArticleCoverVm(title?: string | null, coverUrl?: string | null, coverColor?: string | null): ArticleCoverVm {
    const safeTitle = title?.trim() || ARTICLE_DEFAULT_TITLE
    const rawColor = coverColor?.trim() || null

    return {
        src: coverUrl ?? null,
        alt: `${safeTitle} 封面`,
        color: rawColor || ARTICLE_DEFAULT_COVER_COLOR,
        rawColor,
        hasImage: Boolean(coverUrl),
    }
}

function createArticleSummaryVm(summary?: string | null, previewText?: string | null): ArticleSummaryVm {
    const rawText = summary?.trim() || null
    const preview = previewText?.trim() || null

    if (rawText) {
        return {
            text: rawText,
            rawText,
            isFallback: false,
        }
    }

    if (preview) {
        return {
            text: preview,
            rawText: null,
            isFallback: true,
        }
    }

    return {
        text: '',
        rawText: null,
        isFallback: false,
    }
}

function createArticleMetaVm(input: {
    readMinutes?: number | null
    durationCategory?: string | null
    wordCount?: number | null
    publishedAt?: string | null
    updatedAt?: string | null
}): ArticleMetaVm {
    const readMinutes = normalizeReadMinutes(input.readMinutes, input.wordCount)
    const durationCategory = normalizeDuration(input.durationCategory)
    const typedDuration =
        durationCategory in ARTICLE_DURATION_LABEL_MAP
            ? (durationCategory as keyof typeof ARTICLE_DURATION_LABEL_MAP)
            : undefined

    const publishedAt = toDisplayDate(input.publishedAt)
    const updatedAt = toDisplayDate(input.updatedAt)

    return {
        readMinutes,
        readMinutesText: formatReadMinutes(readMinutes),
        durationCategory,
        durationLabel: typedDuration ? ARTICLE_DURATION_LABEL_MAP[typedDuration] : durationCategory,
        wordCount: typeof input.wordCount === 'number' ? input.wordCount : null,
        wordCountText: formatWordCount(input.wordCount),
        publishedAt,
        updatedAt,
        displayTime: publishedAt || updatedAt,
    }
}

export function mapArticleAuthorDtoToVm(dto?: ArticleAuthorEntityDto | null): ArticleAuthorVm | null {
    return createArticleAuthorVm(dto)
}

export function mapArticleCardDtoToVm(dto: ArticleCardEntityDto): ArticleCardVm {
    const rawTitle = dto.title?.trim() || null
    const title = rawTitle || ARTICLE_DEFAULT_TITLE

    return {
        id: dto.id,
        title,
        titleText: title,
        summary: createArticleSummaryVm(dto.summary, dto.previewText),
        cover: createArticleCoverVm(rawTitle, dto.coverUrl, dto.coverColor),
        meta: createArticleMetaVm({
            readMinutes: dto.readMinutes,
            durationCategory: dto.durationCategory,
            wordCount: dto.wordCount,
            publishedAt: dto.publishedAt,
            updatedAt: dto.updatedAt,
        }),
        status: dto.status ? createArticleStatusVm(dto.status) : null,
        author: createArticleAuthorVm(dto.author),
        latestReason: dto.rejectReason ?? null,
        articlePath: `/articles/${dto.id}`,
        editPath: `/editor/${dto.id}`,
        reviewPath: `/review/articles/${dto.id}`,
    }
}

export function mapArticleDetailDtoToVm(dto: ArticleDetailEntityDto): ArticleDetailVm {
    const rawTitle = dto.title?.trim() || null
    const title = rawTitle || ARTICLE_DEFAULT_TITLE

    return {
        id: dto.id,
        title,
        rawTitle,
        content: dto.content,
        summary: createArticleSummaryVm(dto.summary),
        cover: createArticleCoverVm(rawTitle, dto.coverUrl, dto.coverColor),
        meta: createArticleMetaVm({
            readMinutes: dto.readMinutes,
            durationCategory: dto.durationCategory,
            wordCount: dto.wordCount,
            publishedAt: dto.publishedAt,
            updatedAt: dto.updatedAt,
        }),
        status: createArticleStatusVm(dto.status),
        author: createArticleAuthorVm(dto.author) ?? {
            id: 0,
            username: '',
            displayName: ARTICLE_DEFAULT_AUTHOR_NAME,
            avatarUrl: null,
            initials: 'U',
            profilePath: '',
        },
        latestReviewReason: dto.latestReviewReason ?? null,
        submitCount: dto.submitCount ?? 0,
        submitCountText: `已提交 ${dto.submitCount ?? 0} 次`,
        lastSubmittedAt: toDisplayDate(dto.lastSubmittedAt),
        lastSubmittedAtRaw: dto.lastSubmittedAt ?? null,
        articlePath: `/articles/${dto.id}`,
        editPath: `/editor/${dto.id}`,
        reviewPath: `/review/articles/${dto.id}`,
    }
}

export function mapArticleDraftDtoToVm(dto: ArticleDraftEntityDto): ArticleDraftVm {
    const title = dto.title?.trim() || ARTICLE_DEFAULT_TITLE

    return {
        id: dto.id,
        title,
        status: createArticleStatusVm(dto.status),
        wordCount: dto.wordCount,
        wordCountText: formatWordCount(dto.wordCount) ?? '0 字',
        updatedAt: toDisplayDate(dto.updatedAt) ?? dto.updatedAt,
        latestReason: dto.latestReason ?? null,
        editPath: `/editor/${dto.id}`,
    }
}

export function mapArticleCardListDtoToVm(list: ArticleCardEntityDto[] = []): ArticleCardVm[] {
    return list.map(mapArticleCardDtoToVm)
}
