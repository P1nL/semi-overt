import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { mapArticleDetailDtoToVm } from '@/entities/article/model/article.mapper'
import { mapPendingReviewItemDtoToVm, mapReviewLogListDtoToVm } from '@/entities/review/model/review.mapper'
import { mapUserProfilePageDtoToVm } from '@/entities/user/model/user.mapper'
import { articleApi } from './modules/article'
import { categoryApi } from './modules/category'
import { homeApi } from './modules/home'
import { reviewApi } from './modules/review'
import { searchApi } from './modules/search'
import { userApi, type GetUserProfileParams } from './modules/user'
import { queryKeys } from './queryKeys'

function resolvePositiveInt(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 1) {
        return fallback
    }

    return value
}

export function useHomeQuery() {
    return useQuery({
        queryKey: queryKeys.home,
        queryFn: () => homeApi.getHomeContent(),
    })
}

export function useCategoryArticlesQuery(
    category: MaybeRefOrGetter<string>,
    page: MaybeRefOrGetter<number | undefined>,
    pageSize: MaybeRefOrGetter<number | undefined>,
) {
    return useQuery({
        queryKey: computed(() =>
            queryKeys.category(
                toValue(category),
                resolvePositiveInt(toValue(page), 1),
                resolvePositiveInt(toValue(pageSize), 10),
            ),
        ),
        queryFn: () =>
            categoryApi.getCategoryArticles(toValue(category), {
                page: resolvePositiveInt(toValue(page), 1),
                pageSize: resolvePositiveInt(toValue(pageSize), 10),
            }),
        placeholderData: keepPreviousData,
    })
}

export function useSearchArticlesQuery(
    keyword: MaybeRefOrGetter<string>,
    page: MaybeRefOrGetter<number | undefined>,
    pageSize: MaybeRefOrGetter<number | undefined>,
) {
    return useQuery({
        queryKey: computed(() =>
            queryKeys.search(
                toValue(keyword),
                resolvePositiveInt(toValue(page), 1),
                resolvePositiveInt(toValue(pageSize), 10),
            ),
        ),
        queryFn: () =>
            searchApi.searchArticles({
                keyword: toValue(keyword),
                page: resolvePositiveInt(toValue(page), 1),
                pageSize: resolvePositiveInt(toValue(pageSize), 10),
            }),
        enabled: computed(() => Boolean(toValue(keyword).trim())),
        placeholderData: keepPreviousData,
    })
}

export function useArticleDetailQuery(
    articleId: MaybeRefOrGetter<number | string | null | undefined>,
) {
    return useQuery({
        queryKey: computed(() => queryKeys.articleDetail(String(toValue(articleId) ?? ''))),
        queryFn: async () => mapArticleDetailDtoToVm(await articleApi.getArticleDetail(String(toValue(articleId)))),
        enabled: computed(() => Boolean(toValue(articleId))),
    })
}

export function useUserProfileQuery(
    username: MaybeRefOrGetter<string>,
    params: MaybeRefOrGetter<GetUserProfileParams>,
) {
    return useQuery({
        queryKey: computed(() => {
            const resolvedUsername = toValue(username)
            const resolvedParams = toValue(params)

            return queryKeys.userProfile(
                resolvedUsername,
                resolvedParams.tab ?? 'approved',
                resolvePositiveInt(resolvedParams.page, 1),
                resolvePositiveInt(resolvedParams.pageSize, 10),
            )
        }),
        queryFn: async () => mapUserProfilePageDtoToVm(await userApi.getUserProfile(toValue(username), toValue(params))),
        enabled: computed(() => Boolean(toValue(username).trim())),
        placeholderData: keepPreviousData,
    })
}

export function usePendingReviewsQuery(
    page: MaybeRefOrGetter<number | undefined>,
    pageSize: MaybeRefOrGetter<number | undefined>,
    enabled: MaybeRefOrGetter<boolean> = true,
) {
    return useQuery({
        queryKey: computed(() =>
            queryKeys.reviewPending(
                resolvePositiveInt(toValue(page), 1),
                resolvePositiveInt(toValue(pageSize), 10),
            ),
        ),
        queryFn: async () => {
            const response = await reviewApi.getPendingReviews({
                page: resolvePositiveInt(toValue(page), 1),
                pageSize: resolvePositiveInt(toValue(pageSize), 10),
            })

            return {
                ...response,
                list: response.list.map(mapPendingReviewItemDtoToVm),
            }
        },
        enabled: computed(() => Boolean(toValue(enabled))),
        placeholderData: keepPreviousData,
    })
}

export function useReviewLogsQuery(
    articleId: MaybeRefOrGetter<number | string | null | undefined>,
    enabled: MaybeRefOrGetter<boolean> = true,
) {
    return useQuery({
        queryKey: computed(() => queryKeys.reviewLogs(String(toValue(articleId) ?? ''))),
        queryFn: async () => mapReviewLogListDtoToVm(await reviewApi.getReviewLogs(String(toValue(articleId)))),
        enabled: computed(() => Boolean(toValue(enabled)) && Boolean(toValue(articleId))),
    })
}
