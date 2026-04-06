<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'

import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import { useSearchArticlesQuery } from '@/shared/api/queries'
import { EmptyState, Pagination } from '@/shared/components/base'
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
const currentRoute = computed(() => props.routeOverride ?? route)

const routeKeyword = computed(() => String(currentRoute.value.query.keyword || currentRoute.value.query.q || '').trim())
const page = computed(() => Number(currentRoute.value.query.page || 1) || 1)
const searchQuery = useSearchArticlesQuery(routeKeyword, page, pageSize)

const loading = computed(() => searchQuery.isFetching.value)
const errorMessage = computed(() =>
  searchQuery.error.value
    ? getErrorMessage(searchQuery.error.value, '搜索失败，请稍后重试。')
    : '',
)
const total = computed(() => Number(searchQuery.data.value?.total ?? searchQuery.data.value?.list.length ?? 0))
const list = computed(() =>
  (searchQuery.data.value?.list ?? []).map((item) => mapArticleCardDtoToVm(item)),
)
const contentState = computed(() => {
  if (loading.value) return 'loading'
  if (list.value.length) return 'content'
  return 'empty'
})
const activeKeyword = computed(() => routeKeyword.value)
const searchTitle = computed(() => activeKeyword.value || '搜索结果')
const resultSummary = computed(() => {
  if (!activeKeyword.value) return ''
  return `共找到 ${Math.max(total.value, list.value.length)} 篇与“${activeKeyword.value}”相关的文章`
})
const emptyStateTitle = computed(() => {
  if (errorMessage.value) return '搜索失败'
  if (activeKeyword.value) return '暂无搜索结果'
  return '开始搜索文章'
})
const emptyStateDescription = computed(() => {
  if (errorMessage.value) return errorMessage.value
  if (activeKeyword.value) return `没有找到和“${activeKeyword.value}”相关的文章。`
  return '先输入一个关键词，开始搜索文章。'
})

function resolveSearchLocation(keywordValue: string, nextPage = 1) {
  return {
    name: ROUTE_NAME.SEARCH,
    query: {
      ...(keywordValue ? { keyword: keywordValue } : {}),
      page: nextPage > 1 ? String(nextPage) : undefined,
    },
  }
}

async function onPageChange(nextPage: number) {
  const target = resolveSearchLocation(routeKeyword.value, nextPage)
  if (router.resolve(target).fullPath !== currentRoute.value.fullPath) {
    await router.replace(target)
    return
  }

  if (routeKeyword.value) {
    await searchQuery.refetch()
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
            <ArticleParallaxGallery :items="list" />

            <section
              class="surface-1 content-rise-in rounded-[var(--radius-xl)] p-4 md:p-5"
              :style="{ '--content-rise-delay': `${list.length * 55 + 90}ms` }"
            >
              <Pagination
                :page="page"
                :page-size="pageSize"
                :total="Math.max(total, list.length)"
                @change="onPageChange"
              />
            </section>
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
