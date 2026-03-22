<script setup lang="ts">
import { CategoryChip } from '@/entities/category/ui'
import type { CategoryVm } from '@/entities/category/model/category.types'

defineProps<{
  item: CategoryVm
}>()
</script>

<template>
  <CategoryChip :category="item" />
</template>
