<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/shared/utils/cn'
import Icon from './Icon.vue'
import Button from './Button.vue'

const props = withDefaults(
    defineProps<{
      page: number
      pageSize: number
      total: number
      siblingCount?: number
      showEdges?: boolean
      disabled?: boolean
    }>(),
    {
      siblingCount: 1,
      showEdges: true,
      disabled: false,
    },
)

const emit = defineEmits<{
  (e: 'update:page', value: number): void
  (e: 'change', value: number): void
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const canPrev = computed(() => props.page > 1 && !props.disabled)
const canNext = computed(() => props.page < pageCount.value && !props.disabled)

function updatePage(value: number) {
  const next = Math.min(pageCount.value, Math.max(1, value))
  emit('update:page', next)
  emit('change', next)
}

const pages = computed<(number | '...')[]>(() => {
  const totalPages = pageCount.value
  const current = props.page
  const sibling = props.siblingCount

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const left = Math.max(2, current - sibling)
  const right = Math.min(totalPages - 1, current + sibling)

  const result: (number | '...')[] = [1]

  if (left > 2) result.push('...')
  for (let page = left; page <= right; page += 1) {
    result.push(page)
  }
  if (right < totalPages - 1) result.push('...')
  result.push(totalPages)

  return result
})
</script>

<template>
  <nav class="flex flex-wrap items-center gap-2.5" aria-label="Pagination">
    <Button variant="secondary" size="sm" :disabled="!canPrev" @click="updatePage(page - 1)">
      <template #icon>
        <Icon name="chevron-left" :size="16" />
      </template>
      上一页
    </Button>

    <button
        v-for="(item, index) in pages"
        :key="`${item}-${index}`"
        type="button"
        :disabled="item === '...' || disabled"
        :aria-current="item === page ? 'page' : undefined"
        :class="
        cn(
          'inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--radius-pill)] px-3 text-sm font-medium tracking-[-0.01em] transition-[transform,background-color,border-color,color,box-shadow] duration-220 ease-out',
          item === page
            ? 'bg-[var(--color-primary)] text-white shadow-[var(--shadow-button)]'
            : item === '...'
              ? 'cursor-default text-[var(--color-text-muted)]'
              : 'border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface-glass-strong)_92%,transparent)] text-[var(--color-text)] hover:-translate-y-px hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-elevated)]',
          disabled && 'pointer-events-none opacity-60',
        )
      "
        @click="typeof item === 'number' && updatePage(item)"
    >
      {{ item }}
    </button>

    <Button variant="secondary" size="sm" :disabled="!canNext" @click="updatePage(page + 1)">
      下一页
      <template #trailing>
        <Icon name="chevron-right" :size="16" />
      </template>
    </Button>
  </nav>
</template>
