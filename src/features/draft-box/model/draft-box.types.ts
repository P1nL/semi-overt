import type { ArticleCardVm, ArticleStatusVm } from '@/entities/article'

export interface DraftBoxItem {
    id: number
    title: string
    status: ArticleStatusVm
    wordCount: number
    wordCountText: string
    updatedAt: string
    latestReason: string | null
    editPath: string
    sortAtRaw: string
    canDelete: boolean
}

export interface DraftBoxLoadResult {
    items: DraftBoxItem[]
    badgeCount: number
    pendingWarning: string
}

export interface DraftStoreLike {
    items: ArticleCardVm[]
    badgeCount: number
    loading: boolean
}
