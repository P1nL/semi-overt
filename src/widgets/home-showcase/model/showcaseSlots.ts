import type { ArticleCardVm } from '@/entities/article'

export type ShowcaseSlot =
  | { kind: 'decoration'; key: string }
  | { kind: 'article'; key: string; article: ArticleCardVm; articleIndex: number }

/** Visual filler is never an article: no fake title, ID, route, or duplicate. */
export function createShowcaseSlots(items: readonly ArticleCardVm[], maxVisible: number, fillDecorative = false, reversedLayout = false): ShowcaseSlot[] {
  const limit = Number.isFinite(maxVisible) ? Math.max(0, Math.trunc(maxVisible)) : 0
  const articles: ShowcaseSlot[] = items.slice(0, limit).map((article, articleIndex) => ({
    kind: 'article', key: `article-${article.id}-${articleIndex}`, article, articleIndex,
  }))
  // Empty/loading/error states belong to the parent, not an empty decorative deck.
  if (!fillDecorative || !articles.length) return articles
  const decorations: ShowcaseSlot[] = Array.from({ length: limit - articles.length }, (_, index) => ({
    kind: 'decoration', key: `decoration-${index}`,
  }))
  // Assign content to existing positions; never rearrange the layout itself.
  // Keep each group's original order, including when no filler is needed.
  return reversedLayout ? [...articles, ...decorations] : [...decorations, ...articles]
}

export function isShowcaseLayoutReversed(offsets: readonly number[]) {
  return offsets.length > 1 && offsets[0]! > offsets[offsets.length - 1]!
}
