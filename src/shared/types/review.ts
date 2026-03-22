export type ReviewAction = 'APPROVE' | 'RETURN' | 'REJECT' | 'CANCEL'

export interface ReviewListItemResp {
    articleId: number
    title: string
    submittedAt: string
    submitCount: number
    author: {
        id: number
        username: string
    }
}

export interface ReviewLogResp {
    id: number
    action: ReviewAction
    reason: string | null
    createdAt: string
    operator: {
        id: number
        username: string
    }
}