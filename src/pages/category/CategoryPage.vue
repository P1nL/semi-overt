<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useIntersectionObserver } from '@vueuse/core'

import { CATEGORY_TAB } from '@/entities/category'
import { mapCategoryValueToVm } from '@/entities/category'
import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import { useInfiniteCategoryArticlesQuery } from '@/entities/queries'
import { EmptyState } from '@/shared/components/base'
import { setDocumentTitle } from '@/shared/utils/documentTitle'
import { getErrorMessage } from '@/shared/utils/error'
import {
  ArticleResultStream,
  RESULT_VIEW_MODE,
  isResultViewMode,
  normalizeResultViewMode,
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
const router = useRouter()
const loadMoreRef = ref<HTMLElement | null>(null)
const currentRoute = computed(() => props.routeOverride ?? route)

const activeCategory = computed(() => {
  const value = String(currentRoute.value.params.tab || CATEGORY_TAB.SHORT).toUpperCase()
  if (value in CATEGORY_TAB) return value
  return CATEGORY_TAB.SHORT
})

const resultView = computed(() => {
  const queryView = currentRoute.value.query.view
  return normalizeResultViewMode(queryView)
})
const categoryQuery = useInfiniteCategoryArticlesQuery(activeCategory, 10)
const sectionMeta = computed(() => mapCategoryValueToVm(activeCategory.value, activeCategory.value))
const centerLabel = computed(() =>
  activeCategory.value === CATEGORY_TAB.SHORT ? '3min\n~\n8min' : sectionMeta.value.label,
)
const categoryPages = computed(() => categoryQuery.data.value?.pages ?? [])
const loading = computed(() => categoryQuery.isPending.value && categoryPages.value.length === 0)
const errorMessage = computed(() =>
  categoryQuery.error.value
    ? getErrorMessage(categoryQuery.error.value, '栏目文章加载失败，请稍后重试。')
    : '',
)
const list = computed(() => {
  const seen = new Set<string>()

  return categoryPages.value
    .flatMap((pageData) => pageData.list)
    .map((item) => mapArticleCardDtoToVm(item))
    .filter((item) => {
      const key = String(item.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
})
const total = computed(() => Number(categoryPages.value[0]?.total ?? list.value.length))
const contentState = computed(() => {
  if (loading.value) return 'loading'
  if (list.value.length) return 'content'
  return 'empty'
})

watch(
  () => [currentRoute.value.fullPath, sectionMeta.value.label] as const,
  () => {
    setDocumentTitle(sectionMeta.value.label)
  },
  { immediate: true },
)

async function onViewChange(nextView: string) {
  if (!isResultViewMode(nextView)) return

  await router.replace({
    query: {
      ...currentRoute.value.query,
      view: nextView === RESULT_VIEW_MODE.INFINITE ? undefined : nextView,
    },
  })
}

useIntersectionObserver(
  loadMoreRef,
  ([entry]) => {
    if (!entry?.isIntersecting) return
    if (!categoryQuery.hasNextPage.value || categoryQuery.isFetchingNextPage.value) return

    void categoryQuery.fetchNextPage()
  },
  {
    rootMargin: '0px 0px 320px 0px',
  },
)
</script>

<template>
  <div class="min-h-[calc(100vh-var(--header-height))] md:min-h-[calc(100vh-var(--header-height-md))]">
    <main class="page-container space-y-5 pb-0 pt-0">
      <Transition name="content-fade" mode="out-in">
        <div
          v-if="contentState === 'loading'"
          key="category-loading"
          class="content-loading-shell"
        />

        <div
          v-else-if="contentState === 'content'"
          key="category-content"
          class="space-y-5"
        >
          <ArticleResultStream
            :items="list"
            :view="resultView"
            :center-label="centerLabel"
            :result-count="total"
            fullscreen
            @update:view="onViewChange"
          />

          <div ref="loadMoreRef" class="category-page-load-sentinel" aria-hidden="true" />

          <section
            v-if="resultView !== RESULT_VIEW_MODE.INFINITE"
            class="surface-1 rounded-[var(--radius-xl)] px-4 py-4 text-center md:px-5"
          >
            <p v-if="categoryQuery.isFetchingNextPage.value" class="text-sm text-[var(--color-text-muted)]">
              正在续接更多栏目文章…
            </p>
            <p v-else-if="categoryQuery.hasNextPage.value" class="text-sm text-[var(--color-text-muted)]">
              继续下滑，列表会自动载入更多文章
            </p>
            <p v-else class="text-sm text-[var(--color-text-muted)]">
              END
            </p>
          </section>
        </div>

        <div v-else key="category-empty" class="surface-1 rounded-[var(--radius-xl)] p-8">
          <EmptyState
            title="这里还没有文章"
            :description="errorMessage || ''"
            emoji="🥲"
          />
        </div>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.category-page-load-sentinel {
  width: 100%;
  height: 1px;
}
</style>
