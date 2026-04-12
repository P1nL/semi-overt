<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'

import { CATEGORY_TAB } from '@/entities/category'
import { mapCategoryDtoToSectionVm, mapCategoryValueToVm } from '@/entities/category'
import { useCategoryArticlesQuery } from '@/entities/queries'
import { EmptyState } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
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
const currentRoute = computed(() => props.routeOverride ?? route)

const activeCategory = computed(() => {
  const value = String(currentRoute.value.params.tab || CATEGORY_TAB.SHORT).toUpperCase()
  if (value in CATEGORY_TAB) return value
  return CATEGORY_TAB.SHORT
})

const categoryQuery = useCategoryArticlesQuery(activeCategory, 1, 10)
const sectionMeta = computed(() => mapCategoryValueToVm(activeCategory.value, activeCategory.value))
const loading = computed(() => categoryQuery.isFetching.value)
const errorMessage = computed(() =>
  categoryQuery.error.value
    ? getErrorMessage(categoryQuery.error.value, '栏目文章加载失败，请稍后重试。')
    : '',
)
const list = computed(() => {
  if (!categoryQuery.data.value) {
    return []
  }

  return mapCategoryDtoToSectionVm(categoryQuery.data.value, activeCategory.value).list
})
const contentState = computed(() => {
  if (loading.value) return 'loading'
  if (list.value.length) return 'content'
  return 'empty'
})
</script>

<template>
  <div class="min-h-screen">
    <AppHeader :active-category="activeCategory" />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <section class="px-1 py-2 md:px-2 md:py-3">
        <SectionHeader
          class="category-page-header"
          :title="`${sectionMeta.label}`"
          :description="sectionMeta.description"
          align="center"
          compact
        />
      </section>

      <Transition name="content-fade" mode="out-in">
        <div
          v-if="contentState === 'loading'"
          key="category-loading"
          class="content-loading-shell"
        />

        <ArticleParallaxGallery
          v-else-if="contentState === 'content'"
          key="category-content"
          :items="list"
        />

        <div v-else key="category-empty" class="surface-1 rounded-[var(--radius-xl)] p-8">
          <EmptyState
            title="这里还没有文章"
            :description="errorMessage || '当前栏目暂时没有内容。'"
            emoji="C"
          />
        </div>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.category-page-header :deep(h2) {
  font-size: clamp(2.35rem, 5vw, 3.8rem);
  line-height: 1.08;
  letter-spacing: -0.06em;
}

.category-page-header :deep(p) {
  margin-inline: auto;
  text-align: center;
}
</style>
