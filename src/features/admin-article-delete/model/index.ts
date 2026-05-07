import { articleApi } from '@/shared/api/modules/article'
import { queryKeys } from '@/shared/api/queryKeys'
import type { QueryClient } from '@tanstack/vue-query'

export interface AdminArticleDeleteResult {
    ok: boolean
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function resolveArticleId(value: unknown): string | null {
    if (!isRecord(value)) return null

    const rawId = value.id ?? value.articleId
    if (typeof rawId !== 'number' && typeof rawId !== 'string') return null

    return String(rawId)
}

function filterArticleArray<T>(items: T[] | undefined, articleId: string): T[] | undefined {
    if (!Array.isArray(items)) return items
    return items.filter((item) => resolveArticleId(item) !== articleId)
}

function decrementTotal(value: unknown, removedCount: number): unknown {
    if (typeof value !== 'number' || removedCount <= 0) return value
    return Math.max(0, value - removedCount)
}

function removeArticleFromCachedData<T>(current: T, articleId: string): T {
    if (Array.isArray(current)) {
        return filterArticleArray(current, articleId) as T
    }

    if (!isRecord(current)) {
        return current
    }

    const next: UnknownRecord = { ...current }

    if (Array.isArray(next.pages)) {
        next.pages = next.pages.map((page) => removeArticleFromCachedData(page, articleId))
    }

    if (Array.isArray(next.list)) {
        const before = next.list.length
        const list = filterArticleArray(next.list, articleId) ?? next.list
        next.list = list
        next.total = decrementTotal(next.total, before - list.length)
    }

    if (Array.isArray(next.articles)) {
        const before = next.articles.length
        const articles = filterArticleArray(next.articles, articleId) ?? next.articles
        next.articles = articles
        next.total = decrementTotal(next.total, before - articles.length)
    }

    if (Array.isArray(next.sections)) {
        next.sections = next.sections.map((section) => removeArticleFromCachedData(section, articleId))
    }

    if (isRecord(next.hero)) {
        const hero: UnknownRecord = { ...next.hero }
        if (resolveArticleId(hero.primary) === articleId) {
            hero.primary = null
        }
        if (Array.isArray(hero.secondary)) {
            hero.secondary = filterArticleArray(hero.secondary, articleId) ?? hero.secondary
        }
        next.hero = hero
    }

    return next as T
}

export function syncDeletedArticleCache(queryClient: QueryClient, articleId: number | string): void {
    const articleIdKey = String(articleId)

    queryClient.removeQueries({
        queryKey: queryKeys.articleDetail(articleIdKey),
        exact: true,
    })

    const updater = <T>(current: T | undefined): T | undefined =>
        current === undefined ? current : removeArticleFromCachedData(current, articleIdKey)

    queryClient.setQueriesData({ queryKey: queryKeys.home }, updater)
    queryClient.setQueriesData({ queryKey: ['category'] }, updater)
    queryClient.setQueriesData({ queryKey: ['search'] }, updater)
    queryClient.setQueriesData({ queryKey: queryKeys.userProfileRoot }, updater)
    queryClient.setQueriesData({ queryKey: queryKeys.reviewPendingRoot }, updater)
}

export async function adminDeleteArticleById(
    articleId: number | string,
): Promise<AdminArticleDeleteResult> {
    const result = await articleApi.adminDeleteArticle(articleId)
    return {
        ok: result?.ok ?? true,
    }
}

export async function deleteOwnArticleById(
    articleId: number | string,
): Promise<AdminArticleDeleteResult> {
    await articleApi.deleteArticle(articleId)
    return {
        ok: true,
    }
}
