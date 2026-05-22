import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { mapArticleDetailDtoToVm } from '@/entities/article/model/article.mapper'
import { mapPendingReviewItemDtoToVm, mapReviewLogListDtoToVm } from '@/entities/review'
import { mapUserProfilePageDtoToVm } from '@/entities/user'
import { articleApi } from '@/shared/api/modules/article'
import { categoryApi } from '@/shared/api/modules/category'
import { homeApi } from '@/shared/api/modules/home'
import { reviewApi } from '@/shared/api/modules/review'
import { searchApi } from '@/shared/api/modules/search'
import { userApi, type GetUserProfileParams } from '@/shared/api/modules/user'
import { queryKeys } from '@/shared/api/queryKeys'

type QueryRefreshOptions = {
    refetchIntervalMs?: MaybeRefOrGetter<number | false | undefined>
    refetchOnWindowFocus?: MaybeRefOrGetter<boolean | undefined>
    refetchOnReconnect?: MaybeRefOrGetter<boolean | undefined>
}

function resolvePositiveInt(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 1) {
        return fallback
    }

    return value
}

function createRefreshOptions(
    enabled: MaybeRefOrGetter<boolean>,
    options?: QueryRefreshOptions,
) {
    return {
        refetchInterval: computed(() => {
            if (!toValue(enabled)) {
                return false
            }

            const interval = toValue(options?.refetchIntervalMs)
            return typeof interval === 'number' && interval > 0 ? interval : false
        }),
        refetchOnWindowFocus: computed(() => {
            if (!toValue(enabled)) {
                return false
            }

            return Boolean(toValue(options?.refetchOnWindowFocus))
        }),
        refetchOnReconnect: computed(() => {
            if (!toValue(enabled)) {
                return false
            }

            return Boolean(toValue(options?.refetchOnReconnect))
        }),
    }
}

export function useHomeQuery() {
    return useQuery({
        queryKey: queryKeys.home,
        queryFn: () => homeApi.getHomeContent(),
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
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

export function useInfiniteCategoryArticlesQuery(
    category: MaybeRefOrGetter<string>,
    pageSize: MaybeRefOrGetter<number | undefined>,
    enabled: MaybeRefOrGetter<boolean> = true,
) {
    return useInfiniteQuery({
        queryKey: computed(() =>
            queryKeys.categoryInfinite(
                toValue(category),
                resolvePositiveInt(toValue(pageSize), 10),
            ),
        ),
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            categoryApi.getCategoryArticles(toValue(category), {
                page: resolvePositiveInt(Number(pageParam), 1),
                pageSize: resolvePositiveInt(toValue(pageSize), 10),
            }),
        getNextPageParam: (lastPage) =>
            lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
        enabled: computed(() => Boolean(toValue(enabled))),
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

export function useInfiniteSearchArticlesQuery(
    keyword: MaybeRefOrGetter<string>,
    pageSize: MaybeRefOrGetter<number | undefined>,
    enabled: MaybeRefOrGetter<boolean> = true,
) {
    return useInfiniteQuery({
        queryKey: computed(() =>
            queryKeys.searchInfinite(
                toValue(keyword),
                resolvePositiveInt(toValue(pageSize), 10),
            ),
        ),
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            searchApi.searchArticles({
                keyword: toValue(keyword),
                page: resolvePositiveInt(Number(pageParam), 1),
                pageSize: resolvePositiveInt(toValue(pageSize), 10),
            }),
        getNextPageParam: (lastPage) =>
            lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
        enabled: computed(() => Boolean(toValue(enabled)) && Boolean(toValue(keyword).trim())),
    })
}

export function useInfiniteSearchUsersQuery(
    keyword: MaybeRefOrGetter<string>,
    pageSize: MaybeRefOrGetter<number | undefined>,
    enabled: MaybeRefOrGetter<boolean> = true,
) {
    return useInfiniteQuery({
        queryKey: computed(() =>
            queryKeys.userSearchInfinite(
                toValue(keyword),
                resolvePositiveInt(toValue(pageSize), 10),
            ),
        ),
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            searchApi.searchUsers({
                keyword: toValue(keyword),
                page: resolvePositiveInt(Number(pageParam), 1),
                pageSize: resolvePositiveInt(toValue(pageSize), 10),
            }),
        getNextPageParam: (lastPage) =>
            lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
        enabled: computed(() => Boolean(toValue(enabled)) && Boolean(toValue(keyword).trim())),
    })
}

export function useArticleDetailQuery(
    articleId: MaybeRefOrGetter<number | string | null | undefined>,
    options: QueryRefreshOptions = {},
) {
    const enabled = computed(() => Boolean(toValue(articleId)))
    const refreshOptions = createRefreshOptions(enabled, options)

    return useQuery({
        queryKey: computed(() => queryKeys.articleDetail(String(toValue(articleId) ?? ''))),
        queryFn: async () => mapArticleDetailDtoToVm(await articleApi.getArticleDetail(String(toValue(articleId)))),
        enabled,
        ...refreshOptions,
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
    options: QueryRefreshOptions = {},
) {
    const queryEnabled = computed(() => Boolean(toValue(enabled)))
    const refreshOptions = createRefreshOptions(queryEnabled, options)

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
        enabled: queryEnabled,
        placeholderData: keepPreviousData,
        ...refreshOptions,
    })
}

export function useReviewLogsQuery(
    articleId: MaybeRefOrGetter<number | string | null | undefined>,
    enabled: MaybeRefOrGetter<boolean> = true,
    options: QueryRefreshOptions = {},
) {
    const queryEnabled = computed(() => Boolean(toValue(enabled)))
    const refreshOptions = createRefreshOptions(queryEnabled, options)

    return useQuery({
        queryKey: computed(() => queryKeys.reviewLogs(String(toValue(articleId) ?? ''))),
        queryFn: async () => mapReviewLogListDtoToVm(await reviewApi.getReviewLogs(String(toValue(articleId)))),
        enabled: computed(() => queryEnabled.value && Boolean(toValue(articleId))),
        ...refreshOptions,
    })
}
