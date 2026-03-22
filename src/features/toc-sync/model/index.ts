import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
    TocHeading,
    TocParseOptions,
    TocSyncOptions,
} from './toc-sync.types'

function slugifyHeading(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

function createUniqueHeadingId(base: string, used: Map<string, number>): string {
    const safeBase = base || 'section'
    const count = used.get(safeBase) ?? 0
    used.set(safeBase, count + 1)
    return count === 0 ? safeBase : `${safeBase}-${count + 1}`
}

export function parseMarkdownHeadings(
    markdown: string,
    options: TocParseOptions = {},
): TocHeading[] {
    const levels = options.levels?.length ? options.levels : [2, 3, 4]
    const levelSet = new Set(levels)
    const used = new Map<string, number>()
    const headings: TocHeading[] = []
    const regex = /^(#{1,6})\s+(.+)$/gm

    let match: RegExpExecArray | null = regex.exec(markdown)
    while (match) {
      const level = match[1].length
      if (levelSet.has(level)) {
        const text = match[2].trim()
        const id = createUniqueHeadingId(slugifyHeading(text), used)
        headings.push({ id, text, level })
      }
      match = regex.exec(markdown)
    }

    return headings
}

export function extractHeadingsFromDom(
    selector = 'h2, h3, h4',
    options: TocParseOptions = {},
): TocHeading[] {
    if (typeof document === 'undefined') return []

    const levels = options.levels?.length ? options.levels : [2, 3, 4]
    const levelSet = new Set(levels)
    const used = new Map<string, number>()

    return Array.from(document.querySelectorAll<HTMLElement>(selector))
        .map((element) => {
          const level = Number(element.tagName.toLowerCase().replace('h', ''))
          if (!levelSet.has(level)) return null

          const text = element.textContent?.trim() || ''
          if (!text) return null

          const generatedId = createUniqueHeadingId(slugifyHeading(text), used)
          if (!element.id) {
            element.id = generatedId
          }

          return {
            id: element.id,
            text,
            level,
          } satisfies TocHeading
        })
        .filter((item): item is TocHeading => Boolean(item))
}

export function useTocSync(options: TocSyncOptions = {}) {
    const headings = ref<TocHeading[]>(options.headings ?? [])
    const activeId = ref('')
    let observer: IntersectionObserver | null = null

    function getScrollContainer() {
      return options.getScrollContainer?.() ?? null
    }

    function cleanupObserver() {
      if (observer) {
        observer.disconnect()
        observer = null
      }
    }

    function updateActiveHeadingByElements(entries: IntersectionObserverEntry[]) {
      const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)

      if (!visible.length) return

      const current = visible[0].target as HTMLElement
      activeId.value = current.id
    }

    function bindObserver() {
      if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
        return
      }

      cleanupObserver()

      observer = new IntersectionObserver(updateActiveHeadingByElements, {
        root: getScrollContainer(),
        rootMargin: options.rootMargin ?? '-25% 0px -65% 0px',
        threshold: [0, 0.25, 1],
      })

      headings.value.forEach((heading) => {
        const element = document.getElementById(heading.id)
        if (element) {
          observer?.observe(element)
        }
      })
    }

    function setHeadings(nextHeadings: TocHeading[]) {
      headings.value = nextHeadings
      if (!nextHeadings.length) {
        activeId.value = ''
        return
      }

      if (!activeId.value || !nextHeadings.some((heading) => heading.id === activeId.value)) {
        activeId.value = nextHeadings[0].id
      }
    }

    function resetHeadings() {
      cleanupObserver()
      headings.value = []
      activeId.value = ''
    }

    function refreshHeadingsFromDom() {
      const parsed = extractHeadingsFromDom(options.selector || 'h2, h3, h4')
      setHeadings(parsed)
    }

    function scrollToHeading(id: string, behavior: ScrollBehavior = 'smooth') {
      const element = document.getElementById(id)
      if (!element) return

      const offset = options.offset ?? 88
      const container = getScrollContainer()

      if (container) {
        const top =
            element.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop -
            offset

        container.scrollTo({ top, behavior })
      } else {
        const top = element.getBoundingClientRect().top + window.scrollY - offset
        window.scrollTo({ top, behavior })
      }

      activeId.value = id
    }

    async function syncObserver() {
      await nextTick()
      bindObserver()
    }

    watch(
        () => headings.value.map((item) => item.id).join(','),
        async () => {
          await syncObserver()
        },
    )

    onMounted(() => {
      if (!headings.value.length) {
        refreshHeadingsFromDom()
      }

      if (headings.value.length && !activeId.value) {
        activeId.value = headings.value[0].id
      }

      bindObserver()
    })

    onBeforeUnmount(() => {
      cleanupObserver()
    })

    return {
      headings,
      activeId,
      setHeadings,
      resetHeadings,
      refreshHeadingsFromDom,
      scrollToHeading,
      syncObserver,
    }
}

export type { TocHeading, TocParseOptions, TocSyncOptions } from './toc-sync.types'
