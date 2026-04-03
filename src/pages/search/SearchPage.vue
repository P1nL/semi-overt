<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import { ArticleCard } from '@/entities/article/ui'
import { useSearchArticlesQuery } from '@/shared/api/queries'
import { Button, EmptyState, Input, Pagination } from '@/shared/components/base'
import Icon from '@/shared/components/base/Icon.vue'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/utils/error'
import { useUiStore } from '@/stores/ui'
import { AppHeader } from '@/widgets/app-header'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()

const keyword = ref('')
const pageSize = 10

const routeKeyword = computed(() => String(route.query.keyword || route.query.q || '').trim())
const page = computed(() => Number(route.query.page || 1) || 1)
const searchQuery = useSearchArticlesQuery(routeKeyword, page, pageSize)
const normalizedKeyword = computed(() => keyword.value.trim())
const hasKeyword = computed(() => Boolean(normalizedKeyword.value))

watch(
  routeKeyword,
  (value) => {
    keyword.value = value || uiStore.searchQuery
  },
  { immediate: true },
)

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
const activeKeyword = computed(() => routeKeyword.value || normalizedKeyword.value)
const resultSummary = computed(() => {
  if (!activeKeyword.value || !list.value.length) return ''
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

async function submitSearch() {
  const normalized = normalizedKeyword.value
  uiStore.setSearchQuery(normalized)

  const target = resolveSearchLocation(normalized, 1)
  if (router.resolve(target).fullPath !== route.fullPath) {
    await router.replace(target)
    return
  }

  if (normalized) {
    await searchQuery.refetch()
  }
}

function clearSearchInput() {
  uiStore.clearSearchQuery()
}

async function onPageChange(nextPage: number) {
  const target = resolveSearchLocation(normalizedKeyword.value, nextPage)
  if (router.resolve(target).fullPath !== route.fullPath) {
    await router.replace(target)
    return
  }

  if (normalizedKeyword.value) {
    await searchQuery.refetch()
  }
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <section class="surface-1 rounded-[var(--radius-xl)] p-5 sm:p-6 md:p-8">
        <div class="mb-5">
          <h1 class="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">搜索文章</h1>
          <p class="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">按关键词查找文章，快速定位你想看的内容。</p>
        </div>

        <form class="surface-2 flex flex-col items-stretch gap-2 rounded-[var(--radius-xl)] p-2 sm:flex-row sm:items-center" @submit.prevent="submitSearch">
          <Input
            v-model="keyword"
            class="search-page-input border-none bg-transparent shadow-none"
            placeholder="输入关键词搜索"
            clearable
            @clear="clearSearchInput"
            @enter="submitSearch"
          >
            <template #leading>
              <Icon name="search" :size="16" />
            </template>
          </Input>
          <Button type="submit" pill size="lg" class="w-full sm:w-auto" :loading="loading" :disabled="!hasKeyword">
            搜索
          </Button>
        </form>

        <p v-if="resultSummary" class="mt-4 text-sm text-[var(--color-text-muted)]">
          {{ resultSummary }}
        </p>
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
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="(item, index) in list"
                :key="item.id"
                class="content-rise-in"
                :style="{ '--content-rise-delay': `${index * 55}ms` }"
              >
                <ArticleCard
                  :article="item"
                  :show-reason="false"
                />
              </div>
            </div>

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
.search-page-input :deep(input:focus-visible) {
  outline: none !important;
  outline-offset: 0;
}
</style>
