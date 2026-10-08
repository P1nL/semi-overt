<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ title: string; description?: string; emoji?: string }>(), { description: '', emoji: '🤔' })
const signature = computed(() => JSON.stringify([props.emoji, props.title, props.description]))
</script>

<template>
  <section class="result-empty" role="status" aria-live="polite">
    <div class="result-empty__content" data-page-motion="result-empty" :data-result-empty-key="signature">
      <span class="result-empty__emoji" aria-hidden="true">{{ emoji }}</span>
      <h2 class="result-empty__title">{{ title }}</h2>
      <p v-if="description" class="result-empty__description">{{ description }}</p>
    </div>
  </section>
</template>

<style scoped>
.result-empty { min-height: calc(100svh - var(--header-height)); display: grid; place-items: center; padding: 2rem 1rem; }
.result-empty__content { display: flex; flex-direction: column; align-items: center; gap: 1rem; max-width: 32rem; text-align: center; transform-origin: center; }
.result-empty__emoji { font-size: 3.5rem; line-height: 1.2; }
.result-empty__title { margin: 0; font-size: 1.125rem; font-weight: 600; color: var(--color-text); }
.result-empty__description { margin: 0; font-size: .875rem; line-height: 1.7; color: var(--color-text-muted); }
@media (min-width: 768px) { .result-empty { min-height: calc(100svh - var(--header-height-md)); } }
</style>
