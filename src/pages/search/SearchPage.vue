<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useIntersectionObserver } from '@vueuse/core'

import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import { useInfiniteSearchArticlesQuery, useInfiniteSearchUsersQuery } from '@/entities/queries'
import { Avatar, EmptyState } from '@/shared/components/base'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { setDocumentTitle } from '@/shared/utils/documentTitle'
import { getErrorMessage } from '@/shared/utils/error'
import {
  ArticleResultStream,
  RESULT_VIEW_MODE,
  ResultViewToggle,
  ResultListHeading,
  isResultViewMode,
  normalizeResultViewMode,
  type ResultViewMode,
} from '@/widgets/article-result-stream'

const props = withDefaults(
  defineProps<{
    routeOverride?: RouteLocationNormalizedLoaded | null
  }>(),
  {
    routeOverride: null,
  },
)

const route = useRoute()
const emit = defineEmits<{ 'result-layout': [view: ResultViewMode] }>()
const router = useRouter()
const pageSize = 10
const userSearchLimit = 10
const loadMoreRef = ref<HTMLElement | null>(null)
const currentRoute = computed(() => props.routeOverride ?? route)

function normalizeSearchKeyword(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

const routeType = computed(() => String(currentRoute.value.query.type || '').trim().toLowerCase())
const isUserSearch = computed(() => routeType.value === 'users')
const routeKeyword = computed(() => normalizeSearchKeyword(currentRoute.value.query.keyword || currentRoute.value.query.q))
const resultView = computed(() => {
  const queryView = currentRoute.value.query.view
  return normalizeResultViewMode(queryView)
})
const articleSearchQuery = useInfiniteSearchArticlesQuery(routeKeyword, pageSize, computed(() => !isUserSearch.value))
const userSearchQuery = useInfiniteSearchUsersQuery(routeKeyword, userSearchLimit, isUserSearch)

const articlePages = computed(() => articleSearchQuery.data.value?.pages ?? [])
const userPages = computed(() => userSearchQuery.data.value?.pages ?? [])
const articleList = computed(() => {
  const seen = new Set<string>()

  return articlePages.value
    .flatMap((pageData) => pageData.list)
    .map((item) => mapArticleCardDtoToVm(item))
    .filter((item) => {
      const key = String(item.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
})
const loading = computed(() => {
  if (isUserSearch.value) return userSearchQuery.isPending.value && userList.value.length === 0
  return articleSearchQuery.isPending.value && articleList.value.length === 0
})
const errorMessage = computed(() =>
  (isUserSearch.value ? userSearchQuery.error.value : articleSearchQuery.error.value)
    ? getErrorMessage(
        isUserSearch.value ? userSearchQuery.error.value : articleSearchQuery.error.value,
        isUserSearch.value ? '作者搜索失败，请稍后重试。' : '搜索失败，请稍后重试。',
      )
    : '',
)
const total = computed(() =>
  Number(
    isUserSearch.value
      ? userPages.value[0]?.total ?? userList.value.length
      : articlePages.value[0]?.total ?? articleList.value.length,
  ),
)
const userList = computed(() => {
  const seen = new Set<string>()

  return userPages.value
    .flatMap((pageData) => pageData.list)
    .filter((item) => {
      const key = String(item.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
})
const contentState = computed(() => {
  if (loading.value) return 'loading'
  if (isUserSearch.value ? userList.value.length : articleList.value.length) return 'content'
  return 'empty'
})
const activeKeyword = computed(() => routeKeyword.value)
const searchTitle = computed(() => {
  if (!activeKeyword.value) return isUserSearch.value ? '搜索作者' : '搜索结果'
  return isUserSearch.value ? `作者：${activeKeyword.value}` : activeKeyword.value
})
const documentTitle = computed(() => activeKeyword.value || searchTitle.value)
const layoutView = ref(resultView.value)
watch(layoutView, view => emit('result-layout', view), { immediate: true })
const isInfiniteLayout = computed(() => !isUserSearch.value && layoutView.value === RESULT_VIEW_MODE.INFINITE)
watch(() => [resultView.value, contentState.value, isUserSearch.value] as const, ([view, state, users]) => {
  if (state !== 'content' || users) layoutView.value = view
})
const resultSummary = computed(() => {
  if (!activeKeyword.value) return ''
  if (isUserSearch.value) {
    return `共找到 ${Math.max(total.value, userList.value.length)} 位与“${activeKeyword.value}”相关的作者`
  }

  return `共找到 ${Math.max(total.value, articleList.value.length)} 篇与“${activeKeyword.value}”相关的文章`
})
const showArticleFooter = computed(
  () =>
    layoutView.value !== RESULT_VIEW_MODE.INFINITE ||
    articleSearchQuery.isFetchingNextPage.value ||
    articleSearchQuery.hasNextPage.value,
)
const emptyStateTitle = computed(() => {
  if (errorMessage.value) return '搜索失败'
  if (activeKeyword.value) return isUserSearch.value ? '暂无作者结果' : '暂无搜索结果'
  return isUserSearch.value ? '开始搜索作者' : '开始搜索文章'
})
const emptyStateDescription = computed(() => {
  if (errorMessage.value) return errorMessage.value
  if (activeKeyword.value) {
    return isUserSearch.value
      ? `没有找到和“${activeKeyword.value}”相关的作者。`
      : `没有找到和“${activeKeyword.value}”相关的文章。`
  }

  return isUserSearch.value ? '先输入一个关键词，开始搜索作者。' : '先输入一个关键词，开始搜索文章。'
})

watch(
  () => [route.fullPath, currentRoute.value.fullPath, documentTitle.value] as const,
  () => {
    if (route.name === ROUTE_NAME.SEARCH) setDocumentTitle(documentTitle.value)
  },
  { immediate: true },
)

function resolveSearchLocation(keywordValue: string, nextPage = 1) {
  return {
    name: ROUTE_NAME.SEARCH,
    query: {
      ...(keywordValue ? { keyword: keywordValue } : {}),
      ...(isUserSearch.value ? { type: 'users' } : {}),
      view: !isUserSearch.value && resultView.value !== RESULT_VIEW_MODE.INFINITE ? resultView.value : undefined,
    },
  }
}

async function onViewChange(nextView: string) {
  if (isUserSearch.value || !isResultViewMode(nextView)) return

  const target = {
    name: ROUTE_NAME.SEARCH,
    query: {
      ...(routeKeyword.value ? { keyword: routeKeyword.value } : {}),
      ...(isUserSearch.value ? { type: 'users' } : {}),
      view: nextView === RESULT_VIEW_MODE.INFINITE ? undefined : nextView,
    },
  }

  if (router.resolve(target).fullPath !== currentRoute.value.fullPath) {
    await router.replace(target)
  }
}

useIntersectionObserver(
  loadMoreRef,
  ([entry]) => {
    if (!entry?.isIntersecting) return

    if (isUserSearch.value) {
      if (!userSearchQuery.hasNextPage.value || userSearchQuery.isFetchingNextPage.value) return
      void userSearchQuery.fetchNextPage()
      return
    }

    if (!articleSearchQuery.hasNextPage.value || articleSearchQuery.isFetchingNextPage.value) return
    void articleSearchQuery.fetchNextPage()
  },
  {
    rootMargin: '0px 0px 320px 0px',
  },
)
</script>

<template>
  <div class="min-h-[calc(100vh-var(--header-height))] md:min-h-[calc(100vh-var(--header-height-md))]">
    <main
      class="page-container search-page-main"
      :class="isInfiniteLayout ? 'pb-0 pt-0' : 'space-y-8 py-8 md:space-y-10 md:py-10'"
    >
      <div
        v-if="!isUserSearch && contentState === 'content'"
        class="search-page-view-toggle"
      >
        <ResultViewToggle :model-value="resultView" @update:model-value="onViewChange" />
      </div>

      <ResultListHeading v-if="!isInfiniteLayout" :title="searchTitle" :description="resultSummary" />

      <section class="space-y-5">
        <Transition name="content-fade" mode="out-in">
          <div
            v-if="contentState === 'loading'"
            key="search-loading"
            class="content-loading-shell"
          />

          <div
            v-else-if="contentState === 'content'"
            key="search-content"
            class="space-y-5"
          >
            <template v-if="isUserSearch">
              <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <router-link
                  v-for="user in userList"
                  :key="user.id"
                  :to="user.profilePath"
                  class="surface-1 rounded-[var(--radius-xl)] p-4 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div class="flex items-center gap-3">
                    <Avatar
                      :src="user.avatarUrl || undefined"
                      :name="user.nickname || user.username"
                      size="lg"
                    />

                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-semibold text-[var(--color-text)]">
                        {{ user.nickname || user.username }}
                      </p>
                      <p class="truncate text-sm text-[var(--color-text-muted)]">@{{ user.username }}</p>
                    </div>
                  </div>
                </router-link>
              </section>

              <section class="surface-1 rounded-[var(--radius-xl)] px-4 py-4 text-center md:px-5">
                <div ref="loadMoreRef" class="search-page-load-sentinel" aria-hidden="true" />

                <p v-if="userSearchQuery.isFetchingNextPage.value" class="text-sm text-[var(--color-text-muted)]">
                  正在续接更多作者…
                </p>
                <p v-else-if="userSearchQuery.hasNextPage.value" class="text-sm text-[var(--color-text-muted)]">
                  继续滚动，自动载入
                </p>
              </section>
            </template>

            <template v-else>
              <ArticleResultStream
                :items="articleList"
                :view="resultView"
                fullscreen
                :center-label="isInfiniteLayout ? activeKeyword : ''"
                :result-count="total"
                :show-view-toggle="false"
                @update:view="onViewChange"
                @layout:view="layoutView = $event"
              />

              <section
                v-if="showArticleFooter"
                class="surface-1 content-rise-in rounded-[var(--radius-xl)] px-4 py-4 text-center md:px-5"
                :style="{ '--content-rise-delay': `${articleList.length * 35 + 110}ms` }"
              >
                <div ref="loadMoreRef" class="search-page-load-sentinel" aria-hidden="true" />

                <p v-if="articleSearchQuery.isFetchingNextPage.value" class="text-sm text-[var(--color-text-muted)]">
                  正在续接更多文章…
                </p>
                <p v-else-if="articleSearchQuery.hasNextPage.value" class="text-sm text-[var(--color-text-muted)]">
                  继续滚动，自动载入
                </p>
                <p v-else-if="layoutView !== RESULT_VIEW_MODE.INFINITE" class="text-sm text-[var(--color-text-muted)]">
                  END
                </p>
              </section>
            </template>
          </div>

          <div v-else key="search-empty" class="surface-1 rounded-[var(--radius-xl)] p-8">
            <EmptyState
              :title="emptyStateTitle"
              emoji="🤔"
            />
          </div>
        </Transition>
      </section>
    </main>
  </div>
</template>

<style scoped>
.search-page-main {
  position: relative;
}

.search-page-view-toggle {
  position: absolute;
  top: 1.25rem;
  right: 0;
  z-index: 20;
  display: flex;
  justify-content: flex-end;
}

.search-page-load-sentinel {
  width: 100%;
  height: 1px;
}

@media (max-width: 640px) {
  .search-page-view-toggle {
    top: 0.85rem;
    right: 0.25rem;
  }
}
</style>
