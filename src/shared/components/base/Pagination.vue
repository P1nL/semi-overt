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
  <nav class="pagination-root flex flex-wrap items-center gap-2.5" aria-label="Pagination">
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
            ? 'pagination-page pagination-page--active'
            : item === '...'
              ? 'cursor-default text-[var(--color-text-muted)]'
              : 'pagination-page pagination-page--idle hover:-translate-y-px',
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

<style scoped>
.pagination-page {
  border: 1px solid var(--color-border);
}

.pagination-page--active {
  border-color: color-mix(in srgb, var(--color-primary-strong) 56%, white 20%);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-primary) 88%, white 12%),
    var(--color-primary-strong)
  );
  color: #fff;
  box-shadow: var(--shadow-button);
}

.pagination-page--idle {
  border-color: color-mix(in srgb, var(--color-border-strong) 82%, white 8%);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  color: var(--color-text);
  box-shadow:
    0 4px 14px rgb(15 23 42 / 0.035),
    inset 0 1px 0 rgb(255 255 255 / 0.4);
}

.pagination-page--idle:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-elevated);
}

.pagination-root :deep(.button--secondary) {
  border-color: color-mix(in srgb, var(--color-border-strong) 82%, white 8%);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  box-shadow:
    0 4px 14px rgb(15 23 42 / 0.035),
    inset 0 1px 0 rgb(255 255 255 / 0.4);
}

.pagination-root :deep(.button--secondary:hover) {
  background: var(--color-surface-elevated);
  box-shadow:
    0 10px 22px rgb(15 23 42 / 0.05),
    inset 0 1px 0 rgb(255 255 255 / 0.44);
}

.pagination-root :deep(.button--secondary:disabled) {
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
}

html.dark .pagination-page--active {
  border-color: color-mix(in srgb, var(--color-primary) 72%, white 18%);
  color: #08111d;
}

html.dark .pagination-page--idle {
  border-color: color-mix(in srgb, var(--color-border-strong) 88%, white 6%);
  background: color-mix(in srgb, var(--color-surface-elevated) 92%, transparent);
  box-shadow:
    0 6px 16px rgb(0 0 0 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

html.dark .pagination-root :deep(.button--secondary) {
  border-color: color-mix(in srgb, var(--color-border-strong) 88%, white 6%);
  background: color-mix(in srgb, var(--color-surface-elevated) 92%, transparent);
  box-shadow:
    0 6px 16px rgb(0 0 0 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

html.dark .pagination-root :deep(.button--secondary:hover) {
  background: color-mix(in srgb, var(--color-surface-elevated) 100%, white 4%);
}
</style>
