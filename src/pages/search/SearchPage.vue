<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { mapArticleCardDtoToVm } from '@/entities/article/model/article.mapper'
import { ArticleCard } from '@/entities/article/ui'
import { categoryApi } from '@/shared/api/modules/category'
import { Button, EmptyState, Input, Pagination } from '@/shared/components/base'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/utils/error'
import { useUiStore } from '@/stores/ui'
import { AppHeader } from '@/widgets/app-header'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()

const keyword = ref('')
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const list = ref<ReturnType<typeof mapArticleCardDtoToVm>[]>([])

const routeKeyword = computed(() => String(route.query.keyword || route.query.q || '').trim())
const contentState = computed(() => {
  if (loading.value) return 'loading'
  if (list.value.length) return 'content'
  return 'empty'
})
const emptyStateDescription = computed(() => {
  if (errorMessage.value) return errorMessage.value
  if (keyword.value) return `没有找到和“${keyword.value}”相关的文章。`
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

async function search() {
  const normalized = keyword.value.trim()
  if (!normalized) {
    list.value = []
    total.value = 0
    errorMessage.value = ''
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await categoryApi.searchArticles({
      keyword: normalized,
      page: page.value,
      pageSize: pageSize.value,
    })

    list.value = response.list.map((item) => mapArticleCardDtoToVm(item))
    total.value = Number(response.total ?? response.list.length)
    uiStore.setSearchQuery(normalized)
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '搜索失败，请稍后重试。')
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function submitSearch() {
  page.value = 1

  const target = resolveSearchLocation(keyword.value.trim(), page.value)
  if (router.resolve(target).fullPath !== route.fullPath) {
    await router.replace(target)
    return
  }

  await search()
}

async function onPageChange(nextPage: number) {
  page.value = nextPage

  const target = resolveSearchLocation(keyword.value.trim(), page.value)
  if (router.resolve(target).fullPath !== route.fullPath) {
    await router.replace(target)
    return
  }

  await search()
}

const nextKeyword = routeKeyword.value || uiStore.searchQuery
keyword.value = nextKeyword
page.value = Number(route.query.page || 1) || 1

if (nextKeyword) {
  void search()
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="page-container space-y-8 py-8 md:space-y-10 md:py-10">
      <section class="surface-1 rounded-[var(--radius-xl)] p-6 md:p-8">
        <div class="mb-5">
          <h1 class="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">搜索文章</h1>
          <p class="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">按关键词查找文章，快速定位你想看的内容。</p>
        </div>

        <div class="surface-2 flex items-center gap-2 rounded-[var(--radius-xl)] p-2">
          <Input
            v-model="keyword"
            class="border-none bg-transparent shadow-none"
            placeholder="输入关键词搜索"
            clearable
            @enter="submitSearch"
          />
          <Button type="button" pill :loading="loading" @click="submitSearch">
            搜索
          </Button>
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
              title="暂无搜索结果"
              :description="emptyStateDescription"
              emoji="S"
            />
          </div>
        </Transition>
      </section>
    </main>
  </div>
</template>
