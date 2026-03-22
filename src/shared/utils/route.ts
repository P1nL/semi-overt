import type { RouteLocationRaw, RouteLocationNormalizedLoaded } from 'vue-router'
import { ROUTE_NAME } from '@/shared/constants/routes'

export function isSameRouteTarget(
    currentFullPath: string,
    target?: RouteLocationRaw | null,
): boolean {
    if (!target) return false

    if (typeof target === 'string') {
        return currentFullPath === target
    }

    if ('path' in target && target.path) {
        return currentFullPath === target.path
    }

    return false
}

export function buildProfileRoute(username: string): RouteLocationRaw {
    return {
        name: ROUTE_NAME.PROFILE,
        params: { username },
    }
}

export function buildArticleReadRoute(id: number | string): RouteLocationRaw {
    return {
        name: ROUTE_NAME.ARTICLE_READ,
        params: { id },
    }
}

export function buildArticleEditorRoute(id: number | string): RouteLocationRaw {
    return {
        name: ROUTE_NAME.ARTICLE_EDITOR,
        params: { id },
    }
}

export function buildArticleReviewRoute(id: number | string): RouteLocationRaw {
    return {
        name: ROUTE_NAME.ARTICLE_REVIEW,
        params: { id },
    }
}

export function buildSearchRoute(keyword?: string): RouteLocationRaw {
    return {
        name: ROUTE_NAME.SEARCH,
        query: keyword?.trim() ? { keyword: keyword.trim() } : {},
    }
}

export function getRouteParam(
    route: Pick<RouteLocationNormalizedLoaded, 'params'>,
    key: string,
): string {
    const value = route.params[key]
    if (Array.isArray(value)) return value[0] ?? ''
    return typeof value === 'string' ? value : ''
}

export function getRouteQueryString(
    route: Pick<RouteLocationNormalizedLoaded, 'query'>,
    key: string,
): string {
    const value = route.query[key]
    if (Array.isArray(value)) return value[0] ?? ''
    return typeof value === 'string' ? value : ''
}