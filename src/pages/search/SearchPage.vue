<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'

import { mapArticleCardDtoToVm } from '@/entities/article'
import { useSearchArticlesQuery, useSearchUsersQuery } from '@/entities/queries'
import { Avatar, EmptyState, Pagination } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/utils/error'
import ArticleParallaxGallery from '@/widgets/article-parallax-gallery/ArticleParallaxGallery.vue'
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
const currentRoute = computed(() => props.routeOverride ?? route)

const routeType = computed(() => String(currentRoute.value.query.type || '').trim().toLowerCase())
const isUserSearch = computed(() => routeType.value === 'users')
const routeKeyword = computed(() => String(currentRoute.value.query.keyword || currentRoute.value.query.q || '').trim())
const page = computed(() => Number(currentRoute.value.query.page || 1) || 1)
const articleSearchQuery = useSearchArticlesQuery(routeKeyword, page, pageSize)
const userSearchQuery = useSearchUsersQuery(routeKeyword, userSearchLimit, isUserSearch)

const loading = computed(() =>
  isUserSearch.value ? userSearchQuery.isFetching.value : articleSearchQuery.isFetching.value,
)
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
      ? userSearchQuery.data.value?.total ?? userSearchQuery.data.value?.list.length ?? 0
      : articleSearchQuery.data.value?.total ?? articleSearchQuery.data.value?.list.length ?? 0,
  ),
)
const articleList = computed(() =>
  (articleSearchQuery.data.value?.list ?? []).map((item) => mapArticleCardDtoToVm(item)),
)
const userList = computed(() => userSearchQuery.data.value?.list ?? [])
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
      page: nextPage > 1 ? String(nextPage) : undefined,
    },
  }
}

async function onPageChange(nextPage: number) {
  if (isUserSearch.value) return

  const target = resolveSearchLocation(routeKeyword.value, nextPage)
  if (router.resolve(target).fullPath !== currentRoute.value.fullPath) {
    await router.replace(target)
    return
  }

  if (routeKeyword.value) {
    await articleSearchQuery.refetch()
  }
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <section class="px-1 py-2 md:px-2 md:py-3">
        <SectionHeader
          class="search-page-header"
          :title="searchTitle"
          :description="resultSummary"
          align="center"
          compact
        />
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
                  class="surface-1 rounded-[var(--radius-xl)] p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
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
            </template>

            <template v-else>
              <ArticleParallaxGallery :items="articleList" />

              <section
                class="surface-1 content-rise-in rounded-[var(--radius-xl)] p-4 md:p-5"
                :style="{ '--content-rise-delay': `${articleList.length * 55 + 90}ms` }"
              >
                <Pagination
                  :page="page"
                  :page-size="pageSize"
                  :total="Math.max(total, articleList.length)"
                  @change="onPageChange"
                />
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
</style>
