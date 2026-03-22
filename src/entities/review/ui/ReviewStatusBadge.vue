<!-- src/entities/review/ui/ReviewStatusBadge.vue -->
<script setup lang="ts">
import ArticleStatusBadge from '@/entities/article/ui/ArticleStatusBadge.vue'
import type { ArticleStatusVm } from '@/entities/article/model/article.types'

defineProps<{
  status: ArticleStatusVm
}>()
</script>

<template>
  <ArticleStatusBadge :status="status" />
</template>