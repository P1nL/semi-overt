<!-- src/entities/article/ui/ArticleAuthorMeta.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { Avatar } from '@/shared/components'
import type { ArticleAuthorVm } from '../model/article.types'

const props = withDefaults(
    defineProps<{
      author: ArticleAuthorVm | null
      size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
      clickable?: boolean
    }>(),
    {
      size: 'sm',
      clickable: true,
    },
)

const tag = computed(() => (props.clickable && props.author ? 'RouterLink' : 'div'))
</script>

<template>
  <component
      :is="tag"
      v-if="author"
      :to="clickable ? author.profilePath : undefined"
      class="inline-flex items-center gap-2.5 text-sm text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[var(--color-text)]"
  >
    <Avatar
        :src="author.avatarUrl ?? undefined"
        :alt="author.displayName"
        :name="author.displayName"
        :fallback="author.initials"
        :size="size"
        rounded
    />
    <span class="truncate">{{ author.displayName }}</span>
  </component>

  <div v-else class="inline-flex items-center gap-2.5 text-sm text-[var(--color-text-faint)]">
    <Avatar name="未知作者" fallback="U" :size="size" rounded />
    <span>未知作者</span>
  </div>
</template>
