<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

const props = withDefaults(
    defineProps<{
      content?: string
      emptyText?: string
    }>(),
    {
      content: '',
      emptyText: '正文内容暂时为空。',
    },
)

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
})

const articleRef = ref<HTMLElement | null>(null)
const previewImage = ref<{ src: string; alt: string } | null>(null)

const renderedHtml = computed(() => {
  if (!props.content?.trim()) return ''
  const html = markdown.render(props.content)
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['style', 'target', 'rel', 'class'],
  })
})

function closePreview() {
  previewImage.value = null
}

function openPreview(source: HTMLImageElement) {
  const src = source.currentSrc || source.src
  if (!src) return

  previewImage.value = {
    src,
    alt: source.alt || '文章图片预览',
  }
}

function enhanceImages() {
  const container = articleRef.value
  if (!container) return

  const images = container.querySelectorAll('img')
  images.forEach((image) => {
    image.setAttribute('tabindex', '0')
    image.setAttribute('role', 'button')
    image.setAttribute('aria-label', image.alt || '点击放大图片')
    image.setAttribute('data-previewable', 'true')
  })
}

function handleArticleClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return
  if (!target.dataset.previewable) return

  event.preventDefault()
  openPreview(target)
}

function handleArticleKeydown(event: KeyboardEvent) {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return
  if (!target.dataset.previewable) return
  if (event.key !== 'Enter' && event.key !== ' ') return

  event.preventDefault()
  openPreview(target)
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closePreview()
  }
}

watch(
  renderedHtml,
  async () => {
    await nextTick()
    enhanceImages()
  },
  { immediate: true },
)

watch(
  previewImage,
  (value) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = value ? 'hidden' : ''
  },
)

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <section>
    <article
        v-if="renderedHtml"
        ref="articleRef"
        class="article-reader-body prose max-w-none px-0 py-0"
        v-html="renderedHtml"
        @click="handleArticleClick"
        @keydown="handleArticleKeydown"
    />

    <div
        v-else
        class="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] px-4 py-10 text-center text-sm text-[var(--color-text-muted)]"
    >
      {{ emptyText }}
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="previewImage"
          class="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--color-overlay)_92%,black)] px-4 py-6 backdrop-blur-sm"
          @click.self="closePreview"
          @keydown.window="handleWindowKeydown"
        >
          <button
            type="button"
            class="article-image-preview__close"
            aria-label="关闭图片预览"
            @click="closePreview"
          >
            关闭
          </button>

          <img
            :src="previewImage.src"
            :alt="previewImage.alt"
            class="article-image-preview__image"
          >
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.article-reader-body :deep(h2),
.article-reader-body :deep(h3),
.article-reader-body :deep(h4) {
  scroll-margin-top: 7rem;
}

.article-reader-body :deep(mark) {
  border-radius: 0.22rem;
  background: color-mix(in srgb, var(--color-warning) 24%, transparent);
  padding: 0.02em 0.18em;
}

.article-reader-body :deep(img[data-previewable='true']) {
  cursor: zoom-in;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    opacity 180ms ease;
}

.article-reader-body :deep(img[data-previewable='true']:hover) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.article-reader-body :deep(img[data-previewable='true']:focus-visible) {
  outline: none;
}

.article-image-preview__close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  border: 1px solid color-mix(in srgb, white 24%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, black 30%, transparent);
  padding: 0.55rem 0.9rem;
  color: white;
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
}

.article-image-preview__image {
  display: block;
  max-width: min(96vw, 1100px);
  max-height: calc(100vh - 5rem);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.45);
  object-fit: contain;
}

@media (max-width: 640px) {
  .article-image-preview__close {
    top: 1rem;
    right: 1rem;
  }

  .article-image-preview__image {
    max-width: 100%;
    max-height: calc(100vh - 6rem);
  }
}
</style>
