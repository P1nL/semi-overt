<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'

import { AdminDeleteArticleButton } from '@/features/admin-article-delete'
import { Icon } from '@/shared/components/base'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { queryKeys } from '@/shared/api/queryKeys'
import { useAuthStore } from '@/stores/auth'
import { ArticleReader } from '@/widgets/article-reader'
import { ArticleToc } from '@/widgets/article-toc'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const queryClient = useQueryClient()

const articleId = computed(() => String(route.params.id || ''))
const tocSyncKey = ref(`${articleId.value}-0`)
const mainRef = ref<HTMLElement | null>(null)
const showBackToTop = ref(false)

function onLoaded() {
  tocSyncKey.value = `${articleId.value}-${Date.now()}`
}

async function onArticleDeleted() {
  // 文章被删除后，使首页 query 失效，触发重新请求以补齐卡片数量
  await queryClient.invalidateQueries({ queryKey: queryKeys.home })
  await router.push({ name: ROUTE_NAME.HOME })
}

function handleScroll() {
  showBackToTop.value = (mainRef.value?.scrollTop ?? 0) > 520
}

function scrollToTop() {
  mainRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(
  articleId,
  () => {
    tocSyncKey.value = `${articleId.value}-0`
    showBackToTop.value = false

    requestAnimationFrame(() => {
      mainRef.value?.scrollTo({ top: 0, behavior: 'auto' })
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <main
      ref="mainRef"
      class="flex-1 overflow-y-auto px-4 pb-10 pt-5 md:px-6 md:pb-12 md:pt-6 xl:px-8"
      @scroll.passive="handleScroll"
    >
      <div class="mx-auto grid w-full max-w-[1440px] gap-6 lg:grid-cols-[12rem_minmax(0,54rem)_12rem] lg:justify-center xl:gap-10">
        <section class="mx-auto w-full max-w-[54rem] lg:col-start-2">
          <ArticleReader
            :article-id="articleId"
            :show-status="false"
            @loaded="onLoaded"
          >
            <template #header-actions>
              <AdminDeleteArticleButton
                v-if="authStore.isAdmin"
                :article-id="articleId"
                text="删除文章"
                button-variant="ghost"
                confirm-text="确认删除"
                @deleted="onArticleDeleted"
              />
            </template>
          </ArticleReader>
        </section>

        <div class="hidden lg:flex lg:col-start-3 lg:sticky lg:top-24 lg:h-fit lg:justify-end lg:self-start lg:pr-3 xl:top-28 xl:pr-5">
          <ArticleToc
            :sync-key="tocSyncKey"
            :scroll-container="mainRef"
            transparent
          />
        </div>
      </div>
    </main>

    <button
      type="button"
      class="surface-1 absolute bottom-6 right-6 inline-flex size-12 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-border)_82%,transparent)] text-[var(--color-text)] shadow-[var(--shadow-md)] transition-all duration-300 hover:-translate-y-1 hover:text-[var(--color-primary)]"
      :class="
        showBackToTop
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0'
      "
      aria-label="返回顶部"
      @click="scrollToTop"
    >
      <Icon name="chevron-up" :size="20" />
    </button>
  </div>
</template>
