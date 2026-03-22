<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { ArticleCard } from '@/entities/article/ui'
import { CATEGORY_TAB } from '@/entities/category/model/category.constants'
import { mapCategoryDtoToSectionVm, mapCategoryValueToVm } from '@/entities/category/model/category.mapper'
import { categoryApi } from '@/shared/api/modules/category'
import { EmptyState } from '@/shared/components/base'
import { SectionHeader } from '@/shared/components/layout'
import { getErrorMessage } from '@/shared/utils/error'
import { AppHeader } from '@/widgets/app-header'

const route = useRoute()
const loading = ref(false)
const errorMessage = ref('')
const list = ref<ReturnType<typeof mapCategoryDtoToSectionVm>['list']>([])

const activeCategory = computed(() => {
  const value = String(route.params.tab || CATEGORY_TAB.SHORT).toUpperCase()
  if (value in CATEGORY_TAB) return value
  return CATEGORY_TAB.SHORT
})

const sectionMeta = computed(() => mapCategoryValueToVm(activeCategory.value, activeCategory.value))
const contentState = computed(() => {
  if (loading.value) return 'loading'
  if (list.value.length) return 'content'
  return 'empty'
})

async function loadCategory() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await categoryApi.getCategoryArticles(activeCategory.value)
    const section = mapCategoryDtoToSectionVm(response, activeCategory.value)
    list.value = section.list
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '栏目文章加载失败，请稍后重试。')
    list.value = []
  } finally {
    loading.value = false
  }
}

void loadCategory()
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
