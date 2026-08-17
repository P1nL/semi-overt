import type MarkdownIt from 'markdown-it'

export const CONTENT_LINK_TARGET = '_blank'
export const CONTENT_LINK_REL = 'noopener noreferrer nofollow'

export function configureMarkdownLinks(markdown: MarkdownIt) {
  const defaultLinkOpen = markdown.renderer.rules.link_open

  markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index]
    if (!token) return ''

    token.attrSet('target', CONTENT_LINK_TARGET)
    token.attrSet('rel', CONTENT_LINK_REL)

    if (defaultLinkOpen) {
      return defaultLinkOpen(tokens, index, options, env, self)
    }

    return self.renderToken(tokens, index, options)
  }
}

export function applyContentLinkAttributes(link: HTMLAnchorElement) {
  if (link.getAttribute('target') !== CONTENT_LINK_TARGET) {
    link.setAttribute('target', CONTENT_LINK_TARGET)
  }
  if (link.getAttribute('rel') !== CONTENT_LINK_REL) {
    link.setAttribute('rel', CONTENT_LINK_REL)
  }
}

export function getContentLinkHref(link: HTMLAnchorElement): string {
  return link.href || link.getAttribute('href')?.trim() || ''
}

function normalizeComparableLink(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed.toLowerCase()}`
  }

  const looksLikeDomain = /^(?:www\.)?[^\s./]+(?:\.[^\s./]+)+(?:[/:?#].*)?$/i.test(trimmed)
  const candidate = looksLikeDomain ? `https://${trimmed}` : trimmed

  try {
    const url = new URL(candidate, typeof window === 'undefined' ? 'https://example.invalid' : window.location.href)
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return ''

    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.pathname === '/' && !url.search && !url.hash) {
      return url.href.slice(0, -1)
    }

    return url.href
  } catch {
    return ''
  }
}

export function isPlainContentLink(link: HTMLAnchorElement, href = getContentLinkHref(link)): boolean {
  const text = link.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  const rawHref = link.getAttribute('href')?.trim() ?? ''

  if (!text) return false
  if (text === rawHref || text === href) return true

  const normalizedText = normalizeComparableLink(text)
  const normalizedHref = normalizeComparableLink(href)

  return Boolean(normalizedText && normalizedHref && normalizedText === normalizedHref)
}
