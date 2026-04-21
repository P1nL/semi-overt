<script setup lang="ts">
import { computed } from 'vue'

import type { ArticleCardVm } from '@/entities/article'
import ArticleParallaxGalleryBand from './ArticleParallaxGalleryBand.vue'

interface GalleryBand {
  key: string
  items: Array<{
    article: ArticleCardVm
    key: string
  }>
}

const props = withDefaults(
  defineProps<{
    items: ArticleCardVm[]
    bandSize?: number
  }>(),
  {
    bandSize: 12,
  },
)

const bands = computed<GalleryBand[]>(() => {
  const normalizedBandSize = Math.max(6, props.bandSize)
  const output: GalleryBand[] = []

  for (let start = 0; start < props.items.length; start += normalizedBandSize) {
    const slice = props.items.slice(start, start + normalizedBandSize)

    output.push({
      key: `band-${start}`,
      items: slice.map((article, index) => ({
        article,
        key: `band-${start}-article-${article.id}-slot-${index}`,
      })),
    })
  }

  return output
})
</script>

<template>
  <section class="article-parallax-gallery" aria-label="文章画廊长流">
    <ArticleParallaxGalleryBand
      v-for="(band, index) in bands"
      :key="band.key"
      :items="band.items"
      :band-index="index"
    />
  </section>
</template>

<style scoped>
.article-parallax-gallery {
  display: flex;
  flex-direction: column;
  gap: clamp(1.6rem, 4vw, 2.8rem);
}
</style>
