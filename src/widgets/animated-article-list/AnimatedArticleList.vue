<script setup lang="ts">
import { ArticleCard, type ArticleCardVm } from '@/entities/article'
import AnimatedArticleListItem from './AnimatedArticleListItem.vue'

defineProps<{
  items: ArticleCardVm[]
}>()
</script>

<template>
  <section class="animated-article-list" aria-label="文章列表">
    <AnimatedArticleListItem
      v-for="(article, index) in items"
      :key="article.id"
      :index="index"
    >
      <ArticleCard :article="article" compact />
    </AnimatedArticleListItem>
  </section>
</template>

<style scoped>
.animated-article-list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.85rem;
}
</style>
