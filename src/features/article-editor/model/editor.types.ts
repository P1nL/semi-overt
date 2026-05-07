import type { ArticleDurationCategory } from '@/shared/constants/article'
import type { SaveDraftReqDto } from '@/shared/types/api'

export interface EditorStats {
    wordCount: number
    readMinutes: number
    durationCategory: ArticleDurationCategory
}

export interface EditorFormValues extends EditorStats {
    title: string
    summary: string
    content: string
    coverUrl: string
    coverColor: string
    draftVisible: boolean
}

export type EditorFieldErrors = Partial<Record<'title' | 'summary' | 'content', string>>

export interface EditorValidationResult {
    valid: boolean
    errors: EditorFieldErrors
}

export interface EditorDraftSavedPayload {
    savedAt: string
    wordCount: number
    readMinutes: number
    durationCategory: string
    status: string
    draftVisible: boolean
}

export type EditorDraftPayload = SaveDraftReqDto & {
    draftVisible?: boolean
}

