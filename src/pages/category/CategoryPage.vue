<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { ArticleCard } from '@/entities/article/ui'
import { CATEGORY_TAB } from '@/entities/category/model/category.constants'
import { mapCategoryDtoToSectionVm, mapCategoryValueToVm } from '@/entities/category/model/category.mapper'
import { useCategoryArticlesQuery } from '@/shared/api/queries'
import { EmptyState } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
import { getErrorMessage } from '@/shared/utils/error'
import { AppHeader } from '@/widgets/app-header'

const route = useRoute()

const activeCategory = computed(() => {
  const value = String(route.params.tab || CATEGORY_TAB.SHORT).toUpperCase()
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
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <section class="surface-1 rounded-[var(--radius-xl)] p-6 md:p-8">
        <SectionHeader
          :title="`${sectionMeta.label}栏目`"
          :description="sectionMeta.description"
          compact
        />
      </section>

      <Transition name="content-fade" mode="out-in">
        <div
          v-if="contentState === 'loading'"
          key="category-loading"
          class="content-loading-shell"
        />

        <div
          v-else-if="contentState === 'content'"
          key="category-content"
          class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
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
