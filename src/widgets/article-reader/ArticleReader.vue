<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import { mapArticleDetailDtoToVm } from '@/entities/article/model/article.mapper'
import type { ArticleDetailVm } from '@/entities/article/model/article.types'
import { articleApi } from '@/shared/api/modules/article'
import { Skeleton } from '@/shared/components/base'
import { InlineMessage } from '@/shared/components/feedback'
import { getErrorMessage } from '@/shared/utils/error'
import ArticleReaderBody from './ArticleReaderBody.vue'
import ArticleReaderHeader from './ArticleReaderHeader.vue'

const props = defineProps<{
  articleId: number | string
  showStatus?: boolean
}>()

const emit = defineEmits<{
  loaded: [ArticleDetailVm]
  error: [string]
}>()

const article = ref<ArticleDetailVm | null>(null)
const loading = ref(false)
const errorMessage = ref('')

async function loadArticle() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await articleApi.getArticleDetail(props.articleId)
    article.value = mapArticleDetailDtoToVm(response)
    await nextTick()
    emit('loaded', article.value)
  } catch (error) {
    const message = getErrorMessage(error, '文章加载失败，请稍后重试。')
    errorMessage.value = message
    emit('error', message)
  } finally {
    loading.value = false
  }
}

watch(
    () => props.articleId,
    () => {
      void loadArticle()
    },
    { immediate: true },
)
</script>

<template>
  <section class="space-y-6 md:space-y-8">
    <InlineMessage v-if="errorMessage" tone="error" :message="errorMessage" />

    <div v-if="loading" class="space-y-4">
      <Skeleton variant="rect" width="66%" height="40px" />
      <Skeleton variant="rect" width="192px" height="20px" />
      <Skeleton variant="image" />
      <Skeleton variant="text" :lines="5" />
    </div>

    <div v-else-if="article" class="space-y-6 md:space-y-8">
      <div class="surface-1 rounded-[var(--radius-xl)] px-6 py-6 shadow-[var(--shadow-sm)] md:px-8 md:py-8">
        <ArticleReaderHeader :article="article" :show-status="showStatus ?? true">
          <template #actions>
            <slot name="header-actions" :article="article" />
          </template>
        </ArticleReaderHeader>
      </div>

      <div class="surface-1 rounded-[var(--radius-xl)] px-6 py-6 shadow-[var(--shadow-sm)] md:px-8 md:py-8">
        <ArticleReaderBody :content="article.content" />
      </div>
    </div>
  </section>
</template>
