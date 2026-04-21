<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useIntersectionObserver } from '@vueuse/core'

import { mapArticleCardDtoToVm } from '@/entities/article'
import { useInfiniteSearchArticlesQuery, useInfiniteSearchUsersQuery } from '@/entities/queries'
import { Avatar, EmptyState } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/utils/error'
import { ArticleResultStream, RESULT_VIEW_MODE, ResultViewToggle, isResultViewMode } from '@/widgets/article-result-stream'
import { AppHeader } from '@/widgets/app-header'

const props = withDefaults(
  defineProps<{
    routeOverride?: RouteLocationNormalizedLoaded | null
  }>(),
  {
    routeOverride: null,
  },
)

const route = useRoute()
const router = useRouter()
const pageSize = 10
const userSearchLimit = 10
const loadMoreRef = ref<HTMLElement | null>(null)
const currentRoute = computed(() => props.routeOverride ?? route)

const routeType = computed(() => String(currentRoute.value.query.type || '').trim().toLowerCase())
const isUserSearch = computed(() => routeType.value === 'users')
const routeKeyword = computed(() => String(currentRoute.value.query.keyword || currentRoute.value.query.q || '').trim())
const resultView = computed(() => {
  const queryView = currentRoute.value.query.view
  return isResultViewMode(queryView) ? queryView : RESULT_VIEW_MODE.GALLERY
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
const resultSummary = computed(() => {
  if (!activeKeyword.value) return ''
  if (isUserSearch.value) {
    return `共找到 ${Math.max(total.value, userList.value.length)} 位与“${activeKeyword.value}”相关的作者`
  }

  return `共找到 ${Math.max(total.value, articleList.value.length)} 篇与“${activeKeyword.value}”相关的文章`
})
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

function resolveSearchLocation(keywordValue: string, nextPage = 1) {
  return {
    name: ROUTE_NAME.SEARCH,
    query: {
      ...(keywordValue ? { keyword: keywordValue } : {}),
      ...(isUserSearch.value ? { type: 'users' } : {}),
      view: !isUserSearch.value && resultView.value !== RESULT_VIEW_MODE.GALLERY ? resultView.value : undefined,
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
      view: nextView === RESULT_VIEW_MODE.GALLERY ? undefined : nextView,
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
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <section class="px-1 py-2 md:px-2 md:py-3">
        <div class="search-page-heading">
          <SectionHeader
            class="search-page-header"
            :title="searchTitle"
            :description="resultSummary"
            align="center"
            compact
          />

          <div v-if="!isUserSearch" class="search-page-heading__actions">
            <ResultViewToggle :model-value="resultView" @update:model-value="onViewChange" />
          </div>
        </div>
      </section>

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
                  向下继续滚动，自动载入后续作者
                </p>
                <p v-else class="text-sm text-[var(--color-text-muted)]">
                  已经看到这一轮搜索的全部作者
                </p>
              </section>
            </template>

            <template v-else>
              <ArticleResultStream :items="articleList" :view="resultView" />

              <section
                class="surface-1 content-rise-in rounded-[var(--radius-xl)] px-4 py-4 text-center md:px-5"
                :style="{ '--content-rise-delay': `${articleList.length * 35 + 110}ms` }"
              >
                <div ref="loadMoreRef" class="search-page-load-sentinel" aria-hidden="true" />

                <p v-if="articleSearchQuery.isFetchingNextPage.value" class="text-sm text-[var(--color-text-muted)]">
                  正在续接更多文章…
                </p>
                <p v-else-if="articleSearchQuery.hasNextPage.value" class="text-sm text-[var(--color-text-muted)]">
                  向下继续滚动，自动载入后续结果
                </p>
                <p v-else class="text-sm text-[var(--color-text-muted)]">
                  已经看到这一轮搜索的全部结果
                </p>
              </section>
            </template>
          </div>

          <div v-else key="search-empty" class="surface-1 rounded-[var(--radius-xl)] p-8">
            <EmptyState
              :title="emptyStateTitle"
              :description="emptyStateDescription"
              emoji="S"
            />
          </div>
        </Transition>
      </section>
    </main>
  </div>
</template>

<style scoped>
.search-page-header :deep(h2) {
  font-size: clamp(2.35rem, 5vw, 3.8rem);
  line-height: 1.08;
  letter-spacing: -0.06em;
}

.search-page-header :deep(p) {
  margin-inline: auto;
  text-align: center;
}

.search-page-heading {
  position: relative;
  padding-bottom: 3.25rem;
}

.search-page-heading__actions {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
}

.search-page-load-sentinel {
  width: 100%;
  height: 1px;
}
</style>
