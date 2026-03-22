import {
    ARTICLE_DURATION_CATEGORY,
    ARTICLE_SUMMARY_MAX_LENGTH,
    ARTICLE_TITLE_MAX_LENGTH,
} from '@/shared/constants/article'
import {
    calcReadMinutes,
    calcWordCount,
    resolveDurationCategory,
} from '@/shared/utils/article'
import type { ArticleDetailVm } from '@/entities/article/model/article.types'
import type {
    EditorDraftPayload,
    EditorFormValues,
    EditorStats,
    EditorValidationResult,
} from './editor.types'

export function buildEditorStats(content: string, title = ''): EditorStats {
    const wordCount = calcWordCount(`${title}\n${content}`)
    const readMinutes = calcReadMinutes(wordCount)
    const durationCategory = resolveDurationCategory(wordCount)

    return {
        wordCount,
        readMinutes,
        durationCategory,
    }
}

export function createEmptyEditorFormValues(): EditorFormValues {
    return {
        title: '',
        summary: '',
        content: '',
        coverUrl: '',
        coverColor: '',
        wordCount: 0,
        readMinutes: 0,
        durationCategory: ARTICLE_DURATION_CATEGORY.QUICK,
    }
}

export function mapArticleDetailVmToEditorFormValues(article: ArticleDetailVm): EditorFormValues {
    const stats = buildEditorStats(article.content || '', article.rawTitle || '')

    return {
        title: article.rawTitle || '',
        summary: article.summary.rawText || '',
        content: article.content || '',
        coverUrl: article.cover.src || '',
        coverColor: article.cover.rawColor || '',
        ...stats,
    }
}

export function mapEditorFormToDraftPayload(form: EditorFormValues): EditorDraftPayload {
    const stats = buildEditorStats(form.content, form.title)

    return {
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content || null,
        coverUrl: form.coverUrl.trim(),
        coverColor: form.coverColor.trim(),
        clientWordCount: stats.wordCount,
    }
}

export function validateEditorForm(form: EditorFormValues): EditorValidationResult {
    const errors: EditorValidationResult['errors'] = {}

    if (form.title.length > ARTICLE_TITLE_MAX_LENGTH) {
        errors.title = `标题不能超过 ${ARTICLE_TITLE_MAX_LENGTH} 字`
    }

    if (form.summary.length > ARTICLE_SUMMARY_MAX_LENGTH) {
        errors.summary = `摘要不能超过 ${ARTICLE_SUMMARY_MAX_LENGTH} 字`
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    }
}
