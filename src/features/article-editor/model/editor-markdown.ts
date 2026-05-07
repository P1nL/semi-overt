import DOMPurify from 'dompurify'
import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import MarkdownIt from 'markdown-it'

import { normalizeEditorImageWidthPercent } from './editor-image'

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
})

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
  const content = serializeBlockNodes(document.content ?? []).trim()

  return content.replace(/\n{3,}/g, '\n\n')
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
      const text = serializeInlineNodes(node.content ?? [])
      return wrapAlignedBlock('p', text, getTextAlign(node))
    }
    case 'heading': {
      const level = clampHeadingLevel(node.attrs?.level)
      const text = serializeInlineNodes(node.content ?? [])
      const alignment = getTextAlign(node)

      if (alignment && alignment !== 'left') {
        return `<h${level} style="text-align: ${alignment};">${text}</h${level}>`
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
    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : ''
      const code = serializeCodeContent(node.content ?? [])
      return `\`\`\`${language}\n${code}\n\`\`\``
    }
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

  if (items.some((item) => getListItemTextAlign(item))) {
    return serializeAlignedListAsHtml(node, ordered)
  }

  return items
    .map((item, index) => serializeListItem(item, ordered, depth, index))
    .filter(Boolean)
    .join('\n')
}

function serializeAlignedListAsHtml(node: JSONContent, ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul'
  const items = node.content ?? []
  const body = items
    .map((item) => {
      const alignment = getListItemTextAlign(item)
      const style = alignment ? ` style="text-align: ${alignment};"` : ''
      const content = serializeListItemContentAsHtml(item)

      return `<li${style}>${content}</li>`
    })
    .join('\n')

  return `<${tag}>\n${body}\n</${tag}>`
}

function serializeListItemContentAsHtml(node: JSONContent): string {
  return (node.content ?? [])
    .map((child) => {
      if (child.type === 'paragraph') {
        return serializeInlineNodesAsHtml(child.content ?? [])
      }

      if (child.type === 'bulletList' || child.type === 'orderedList') {
        return serializeAlignedListAsHtml(child, child.type === 'orderedList')
      }

      return serializeBlockNodeAsHtml(child)
    })
    .filter(Boolean)
    .join('\n')
}

function serializeBlockNodeAsHtml(node: JSONContent): string {
  switch (node.type) {
    case 'heading': {
      const level = clampHeadingLevel(node.attrs?.level)
      const alignment = getTextAlign(node)
      const style = alignment ? ` style="text-align: ${alignment};"` : ''
      return `<h${level}${style}>${serializeInlineNodesAsHtml(node.content ?? [])}</h${level}>`
    }
    case 'codeBlock':
      return `<pre><code>${escapeHtmlText(serializeCodeContent(node.content ?? []))}</code></pre>`
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
  index: number,
): string {
  const indent = '  '.repeat(depth)
  const prefix = ordered ? `${index + 1}. ` : '- '
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
      lines.push(serializeList(child, child.type === 'orderedList', depth + 1))
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
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return applyTextMarks(node.text ?? '', node.marks ?? [])
      }

      if (node.type === 'hardBreak') {
        return '  \n'
      }

      if (node.type === 'image') {
        return serializeImageNode(node)
      }

      return serializeInlineNodes(node.content ?? [])
    })
    .join('')
}

function serializeInlineNodesAsHtml(nodes: JSONContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return applyTextMarksAsHtml(node.text ?? '', node.marks ?? [])
      }

      if (node.type === 'hardBreak') {
        return '<br />'
      }

      if (node.type === 'image') {
        return serializeImageNodeAsHtml(node)
      }

      return serializeInlineNodesAsHtml(node.content ?? [])
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
  let output = escapeMarkdownText(text)
  const marksList = marks ?? []
  const markTypes = new Set(marksList.map((mark) => mark.type))
  const linkMark = marksList.find((mark) => mark.type === 'link')

  if (markTypes.has('italic')) {
    output = `*${output}*`
  }

  if (markTypes.has('strike')) {
    output = `~~${output}~~`
  }

  if (markTypes.has('bold')) {
    output = `**${output}**`
  }

  if (markTypes.has('underline')) {
    output = `<u>${output}</u>`
  }

  if (markTypes.has('highlight')) {
    output = `<mark>${output}</mark>`
  }

  if (linkMark && typeof linkMark.attrs?.href === 'string' && linkMark.attrs.href) {
    output = `[${output}](${linkMark.attrs.href})`
  }

  return output
}

function applyTextMarksAsHtml(text: string, marks: JSONContent['marks'] = []): string {
  let output = escapeHtmlText(text)
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
    output = `<a href="${escapeHtmlAttribute(linkMark.attrs.href)}">${output}</a>`
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
    .map((node) => {
      if (node.type === 'paragraph') {
        return `<p>${serializeInlineNodesAsHtml(node.content ?? [])}</p>`
      }

      return serializeBlockNodeAsHtml(node)
    })
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

  if (widthPercent === null) {
    return `![${escapeMarkdownText(alt)}](${src})`
  }

  const titleAttribute = title ? ` title="${escapeHtmlAttribute(title)}"` : ''

  return `<img src="${escapeHtmlAttribute(src)}" alt="${escapeHtmlAttribute(alt)}"${titleAttribute} data-width="${widthPercent}" style="width: ${widthPercent}%; height: auto;" />`
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

function wrapAlignedBlock(tag: 'p', text: string, alignment: string | null): string {
  if (!alignment) {
    return text
  }

  return `<${tag} style="text-align: ${alignment};">${text}</${tag}>`
}

function clampHeadingLevel(level: unknown): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) {
    return 2
  }

  return Math.max(1, Math.min(6, Math.trunc(level)))
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1')
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
