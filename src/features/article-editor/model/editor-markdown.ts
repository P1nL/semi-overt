import DOMPurify from 'dompurify'
import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import MarkdownIt from 'markdown-it'

import { CONTENT_LINK_REL, CONTENT_LINK_TARGET, configureMarkdownLinks } from '@/shared/utils/contentLinks'

import { normalizeEditorImageWidthPercent } from './editor-image'

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
})

configureMarkdownLinks(markdown)
// Whitespace-preserving editor imports must not mistake renderer pretty-printing
// around block tags or <br> for user-entered spaces/line breaks (tight lists
// in particular omit <p>, leaving the renderer's newline inside the list item).
const renderToken = markdown.renderer.renderToken.bind(markdown.renderer)
markdown.renderer.renderToken = (tokens, index, options) => renderToken(tokens, index, options).trim()
markdown.renderer.rules.hardbreak = () => '<br />'
markdown.renderer.rules.softbreak = () => '<br />'

export function renderMarkdownToEditorHtml(content: string): string {
  if (!content.trim()) {
    return '<p></p>'
  }

  return DOMPurify.sanitize(markdown.render(content), {
    ADD_ATTR: ['style', 'target', 'rel', 'class', 'data-width', 'colspan', 'rowspan', 'colwidth', 'align'],
  })
}

export function serializeEditorToMarkdown(editor: Pick<Editor, 'getJSON'>): string {
  const document = editor.getJSON()
  const onlyBlock = document.content?.length === 1 ? document.content[0] : null
  if (onlyBlock?.type === 'paragraph' && !onlyBlock.content?.length && !getTextAlign(onlyBlock)) return ''
  return serializeBlockNodes(document.content ?? []).trim()
}

function serializeBlockNodes(nodes: JSONContent[]): string {
  return nodes
    .map((node) => serializeBlockNode(node))
    .filter(Boolean)
    .join('\n\n')
}

function serializeBlockNode(node: JSONContent, depth = 0): string {
  switch (node.type) {
    case 'paragraph': {
      if (getTextAlign(node)) return serializeBlockNodeAsHtml(node)
      if (!node.content?.length) return '<p></p>'
      return serializeInlineNodes(node.content)
    }
    case 'heading': {
      const level = clampHeadingLevel(node.attrs?.level)
      const text = serializeInlineNodes(node.content ?? [])
      const alignment = getTextAlign(node)

      if (alignment && alignment !== 'left') {
        return serializeBlockNodeAsHtml(node)
      }

      return `${'#'.repeat(level)} ${text}`.trim()
    }
    case 'bulletList':
      return serializeList(node, false, depth)
    case 'orderedList':
      return serializeList(node, true, depth)
    case 'blockquote': {
      const inner = serializeBlockNodes(node.content ?? [])
      return inner
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
    }
    // Fenced Markdown normalizes a final newline into the code content. Raw
    // <pre><code> preserves exact text, including zero or many trailing newlines.
    case 'codeBlock':
      return serializeBlockNodeAsHtml(node)
    case 'horizontalRule':
      return '---'
    case 'image': {
      return serializeImageNode(node)
    }
    case 'table':
      return serializeTableNodeAsHtml(node)
    default:
      return serializeInlineNodes(node.content ?? [])
  }
}

function serializeList(node: JSONContent, ordered: boolean, depth: number): string {
  const items = node.content ?? []

  if (items.some((item) => getListItemTextAlign(item) || (item.content ?? []).some((child, index) =>
    index > 0 && child.type !== 'bulletList' && child.type !== 'orderedList',
  ))) {
    return serializeListAsHtml(node, ordered)
  }

  const start = ordered ? toPositiveInteger(node.attrs?.start) ?? 1 : 1
  return items
    .map((item, index) => serializeListItem(item, ordered, depth, start + index))
    .filter(Boolean)
    .join('\n')
}

function serializeListAsHtml(node: JSONContent, ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul'
  const start = ordered ? toPositiveInteger(node.attrs?.start) ?? 1 : 1
  const attributes = ordered && start !== 1 ? ` start="${start}"` : ''
  const items = node.content ?? []
  const body = items
    .map((item) => {
      const alignment = getListItemTextAlign(item)
      const style = alignment ? ` style="text-align: ${alignment};"` : ''
      const content = serializeBlockNodesAsHtml(item.content ?? [])

      return `<li${style}>${content}</li>`
    })
    .join('\n')

  return `<${tag}${attributes}>\n${body}\n</${tag}>`
}

function serializeBlockNodeAsHtml(node: JSONContent): string {
  switch (node.type) {
    case 'paragraph': {
      const alignment = getTextAlign(node)
      const style = alignment ? ` style="text-align: ${alignment};"` : ''
      return `<p${style}>${serializeInlineNodesAsHtml(node.content ?? [])}</p>`
    }
    case 'heading': {
      const level = clampHeadingLevel(node.attrs?.level)
      const alignment = getTextAlign(node)
      const style = alignment ? ` style="text-align: ${alignment};"` : ''
      return `<h${level}${style}>${serializeInlineNodesAsHtml(node.content ?? [])}</h${level}>`
    }
    case 'bulletList':
    case 'orderedList':
      return serializeListAsHtml(node, node.type === 'orderedList')
    case 'blockquote':
      return `<blockquote>${serializeBlockNodesAsHtml(node.content ?? [])}</blockquote>`
    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : ''
      const attributes = language ? ` class="language-${escapeHtmlAttribute(language)}"` : ''
      return `<pre><code${attributes}>${escapeHtmlText(serializeCodeContent(node.content ?? []))}</code></pre>`
    }
    case 'horizontalRule':
      return '<hr />'
    case 'image':
      return serializeImageNodeAsHtml(node)
    case 'table':
      return serializeTableNodeAsHtml(node)
    default:
      return serializeInlineNodesAsHtml(node.content ?? [])
  }
}

function serializeListItem(
  node: JSONContent,
  ordered: boolean,
  depth: number,
  number: number,
): string {
  const indent = '  '.repeat(depth)
  const prefix = ordered ? `${number}. ` : '- '
  const continuationIndent = `${indent}${' '.repeat(prefix.length)}`
  const blocks = node.content ?? []
  const lines: string[] = []

  blocks.forEach((child, childIndex) => {
    if (child.type === 'paragraph') {
      const text = serializeInlineNodes(child.content ?? [])
      if (!text) {
        if (childIndex === 0) {
          lines.push(`${indent}${prefix}`.trimEnd())
        }
        return
      }

      const paragraphLines = text.split('\n')
      paragraphLines.forEach((line, lineIndex) => {
        if (childIndex === 0 && lineIndex === 0) {
          lines.push(`${indent}${prefix}${line}`)
          return
        }

        lines.push(`${continuationIndent}${line}`)
      })
      return
    }

    if (child.type === 'bulletList' || child.type === 'orderedList') {
      const nested = serializeList(child, child.type === 'orderedList', 0)
      lines.push(...nested.split('\n').map((line) => `${continuationIndent}${line}`))
      return
    }

    const block = serializeBlockNode(child, depth + 1)
    if (!block) return

    block.split('\n').forEach((line, lineIndex) => {
      if (childIndex === 0 && lineIndex === 0 && !lines.length) {
        lines.push(`${indent}${prefix}${line}`)
        return
      }

      lines.push(`${continuationIndent}${line}`)
    })
  })

  return lines.join('\n')
}

function serializeInlineNodes(nodes: JSONContent[]): string {
  return serializeInlineContent(nodes, false)
}

function serializeInlineNodesAsHtml(nodes: JSONContent[]): string {
  return serializeInlineContent(nodes, true)
}

function serializeInlineContent(nodes: JSONContent[], asHtml: boolean): string {
  let atLineStart = true
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        const text = node.text ?? ''
        const isCode = node.marks?.some((mark) => mark.type === 'code')
        const leading = atLineStart && !isCode ? text.match(/^[\t \u00a0\u3000]+/)?.[0] ?? '' : ''
        const remaining = text.slice(leading.length)
        if (remaining) atLineStart = false
        const applyMarks = asHtml ? applyTextMarksAsHtml : applyTextMarks
        return serializeLeadingWhitespace(leading) + (remaining ? applyMarks(remaining, node.marks) : '')
      }

      if (node.type === 'hardBreak') {
        // A soft line break starts a new indentation scope, not a new paragraph.
        atLineStart = true
        return asHtml ? '<br />' : '  \n'
      }

      atLineStart = false
      if (node.type === 'image') {
        return asHtml ? serializeImageNodeAsHtml(node) : serializeImageNode(node)
      }

      return serializeInlineContent(node.content ?? [], asHtml)
    })
    .join('')
}

function serializeLeadingWhitespace(value: string): string {
  return Array.from(value)
    .map((character) => {
      if (character === '\t') return '&nbsp;&nbsp;&nbsp;&nbsp;'
      if (character === '\u3000') return '&#12288;'
      return '&nbsp;'
    })
    .join('')
}

function serializeCodeContent(nodes: JSONContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return node.text ?? ''
      }

      if (node.type === 'hardBreak') {
        return '\n'
      }

      return serializeCodeContent(node.content ?? [])
    })
    .join('')
}

function applyTextMarks(text: string, marks: JSONContent['marks'] = []): string {
  const isCode = marks?.some((mark) => mark.type === 'code')
  const output = isCode ? serializeInlineCode(text) : escapeMarkdownText(text)
  // HTML marks are already part of the content format. Unlike per-node **/*/~~,
  // explicit boundaries remain unambiguous with spaces and overlapping marks.
  return wrapTextMarks(output, marks)
}

function applyTextMarksAsHtml(text: string, marks: JSONContent['marks'] = []): string {
  let output = escapeHtmlText(text)
  if (marks?.some((mark) => mark.type === 'code')) output = `<code>${output}</code>`
  return wrapTextMarks(output, marks)
}

function longestBacktickRun(value: string): number {
  return Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length))
}

function serializeInlineCode(text: string): string {
  const delimiter = '`'.repeat(longestBacktickRun(text) + 1)
  const padding = /`/.test(text) || (/^ .* $/.test(text) && /[^ ]/.test(text)) ? ' ' : ''
  return `${delimiter}${padding}${text}${padding}${delimiter}`
}

function wrapTextMarks(output: string, marks: JSONContent['marks'] = []): string {
  const marksList = marks ?? []
  const markTypes = new Set(marksList.map((mark) => mark.type))
  const linkMark = marksList.find((mark) => mark.type === 'link')

  if (markTypes.has('bold')) {
    output = `<strong>${output}</strong>`
  }

  if (markTypes.has('italic')) {
    output = `<em>${output}</em>`
  }

  if (markTypes.has('strike')) {
    output = `<s>${output}</s>`
  }

  if (markTypes.has('underline')) {
    output = `<u>${output}</u>`
  }

  if (markTypes.has('highlight')) {
    output = `<mark>${output}</mark>`
  }

  if (linkMark && typeof linkMark.attrs?.href === 'string' && linkMark.attrs.href) {
    output = `<a href="${escapeHtmlAttribute(linkMark.attrs.href)}" target="${CONTENT_LINK_TARGET}" rel="${CONTENT_LINK_REL}">${output}</a>`
  }

  return output
}

function getListItemTextAlign(node: JSONContent): string | null {
  const ownAlignment = getTextAlign(node)
  if (ownAlignment) {
    return ownAlignment
  }

  const paragraph = (node.content ?? []).find((child) => child.type === 'paragraph')
  return paragraph ? getTextAlign(paragraph) : null
}

function getTextAlign(node: JSONContent): string | null {
  const alignment = node.attrs?.textAlign

  if (alignment === 'center' || alignment === 'right') {
    return alignment
  }

  return null
}

function serializeTableNodeAsHtml(node: JSONContent): string {
  const rows = node.content ?? []
  const body = rows
    .map((row) => serializeTableRowNodeAsHtml(row))
    .filter(Boolean)
    .join('\n')

  return `<table>\n<tbody>\n${body}\n</tbody>\n</table>`
}

function serializeTableRowNodeAsHtml(node: JSONContent): string {
  const cells = (node.content ?? [])
    .map((cell) => serializeTableCellNodeAsHtml(cell))
    .filter(Boolean)
    .join('')

  return `<tr>${cells}</tr>`
}

function serializeTableCellNodeAsHtml(node: JSONContent): string {
  const tag = node.type === 'tableHeader' ? 'th' : 'td'
  const attrs = serializeTableCellAttributes(node)
  const content = serializeBlockNodesAsHtml(node.content ?? [])

  return `<${tag}${attrs}>${content || '<p></p>'}</${tag}>`
}

function serializeBlockNodesAsHtml(nodes: JSONContent[]): string {
  return nodes
    .map((node) => serializeBlockNodeAsHtml(node))
    .filter(Boolean)
    .join('')
}

function serializeTableCellAttributes(node: JSONContent): string {
  const attrs: string[] = []
  const colspan = toPositiveInteger(node.attrs?.colspan)
  const rowspan = toPositiveInteger(node.attrs?.rowspan)
  const colwidth = normalizeColwidth(node.attrs?.colwidth)
  const align = getTableCellAlign(node)

  if (colspan && colspan > 1) {
    attrs.push(`colspan="${colspan}"`)
  }

  if (rowspan && rowspan > 1) {
    attrs.push(`rowspan="${rowspan}"`)
  }

  if (colwidth) {
    attrs.push(`colwidth="${escapeHtmlAttribute(colwidth)}"`)
  }

  if (align) {
    attrs.push(`align="${align}"`)
  }

  return attrs.length ? ` ${attrs.join(' ')}` : ''
}

function normalizeColwidth(value: unknown): string {
  if (!Array.isArray(value)) return ''

  return value
    .map((item) => toPositiveInteger(item))
    .filter((item): item is number => typeof item === 'number')
    .join(',')
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const integer = Math.trunc(value)
  return integer > 0 ? integer : null
}

function getTableCellAlign(node: JSONContent): string | null {
  const alignment = node.attrs?.align

  if (alignment === 'left' || alignment === 'center' || alignment === 'right') {
    return alignment
  }

  return null
}

function serializeImageNode(node: JSONContent): string {
  const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
  if (!src) return ''

  const alt = typeof node.attrs?.alt === 'string' && node.attrs.alt.trim() ? node.attrs.alt : 'image'
  const title = typeof node.attrs?.title === 'string' && node.attrs.title.trim() ? node.attrs.title : ''
  const widthPercent = normalizeEditorImageWidthPercent(node.attrs?.widthPercent)

  if (widthPercent === null && !title && !/[\s()<>]/.test(src)) {
    return `![${escapeMarkdownText(alt)}](${src})`
  }

  return serializeImageNodeAsHtml(node)
}

function serializeImageNodeAsHtml(node: JSONContent): string {
  const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
  if (!src) return ''

  const alt = typeof node.attrs?.alt === 'string' && node.attrs.alt.trim() ? node.attrs.alt : 'image'
  const title = typeof node.attrs?.title === 'string' && node.attrs.title.trim() ? node.attrs.title : ''
  const widthPercent = normalizeEditorImageWidthPercent(node.attrs?.widthPercent)
  const titleAttribute = title ? ` title="${escapeHtmlAttribute(title)}"` : ''
  const widthAttributes = widthPercent === null
    ? ''
    : ` data-width="${widthPercent}" style="width: ${widthPercent}%; height: auto;"`

  return `<img src="${escapeHtmlAttribute(src)}" alt="${escapeHtmlAttribute(alt)}"${titleAttribute}${widthAttributes} />`
}

function clampHeadingLevel(level: unknown): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) {
    return 2
  }

  return Math.max(1, Math.min(6, Math.trunc(level)))
}

function escapeMarkdownText(value: string): string {
  return escapeHtmlText(value).replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1')
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
