<script setup lang="ts">
import { SectionHeader } from '@/shared/components/layout'

defineProps<{ title: string; description?: string }>()
</script>

<template>
  <section class="result-list-heading px-1 py-2 md:px-2 md:py-3">
    <SectionHeader :title="title" :description="description" align="center" compact />
  </section>
</template>

<style scoped>
.result-list-heading :deep(h2) {
  font-size: clamp(2.35rem, 5vw, 3.8rem);
  line-height: 1.08;
  letter-spacing: -0.06em;
}
.result-list-heading :deep(p) { margin-inline: auto; text-align: center; }
</style>
