export type DurationCategory = 'QUICK' | 'SHORT' | 'DEEP'

export type ArticleStatus =
    | 'DRAFT'
    | 'PENDING'
    | 'APPROVED'
    | 'RETURNED'
    | 'REJECTED'

export interface ArticleCardResp {
    articleId: number
    title: string | null
    summary: string | null
    previewText?: string | null
    coverUrl: string | null
    coverColor: string | null
    readMinutes: number
    durationCategory: DurationCategory
    status?: ArticleStatus
    authorName: string
    authorAvatar: string | null
    username?: string
    rejectReason?: string | null
}

export interface ArticleDetailResp {
    id: number
    title: string | null
    content: string
    summary: string | null
    coverUrl: string | null
    wordCount: number
    readMinutes: number
    durationCategory: DurationCategory
    status: ArticleStatus
    latestReviewReason: string | null
    author: {
        id: number
        username: string
        avatarUrl: string | null
    }
}
