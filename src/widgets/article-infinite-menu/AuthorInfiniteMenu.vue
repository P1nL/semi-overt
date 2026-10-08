<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { UserProfileVm } from '@/entities/user'
import { useAuthorResultProfilesQuery } from '@/entities/queries'
import ArticleInfiniteMenu from './ArticleInfiniteMenu.vue'

const props = defineProps<{ items: UserProfileVm[]; centerLabel: string; resultCount: number }>()
const emit = defineEmits<{ 'load-more': [] }>()
const profiles = useAuthorResultProfilesQuery(computed(() => props.items))
const displayed = shallowRef<UserProfileVm[]>([])
watch(profiles, result => { if (!result.pending) displayed.value = result.profiles }, { immediate: true })
function activeChanged(index: number) {
  if (index >= props.items.length - 3) emit('load-more')
}
</script>

<template>
  <section class="author-result-stream" :aria-busy="profiles.pending" aria-label="作者搜索结果">
    <div v-if="!displayed.length" class="content-loading-shell" />
    <ArticleInfiniteMenu v-else :authors="displayed" fullscreen :center-label="centerLabel" :result-count="resultCount" @active-change="activeChanged" />
  </section>
</template>

<style scoped>
.author-result-stream { width: 100vw; margin-left: calc(50% - 50vw); }
</style>
