import type { ArticleCardVm } from '@/entities/article'

export interface ArticleMenuTextureItem {
  article: ArticleCardVm
  texture: HTMLCanvasElement
}

const TEXTURE_WIDTH = 768
const TEXTURE_HEIGHT = 960
const CARD_INSET = 14
const CARD_RADIUS = 38
const TITLE_HORIZONTAL_PADDING = 52
const TITLE_VERTICAL_PADDING = 64

interface TextureTheme {
  surfaceElevated: string
  text: string
  border: string
  dark: boolean
}

function readToken(style: CSSStyleDeclaration, name: string, fallback: string) {
  return style.getPropertyValue(name).trim() || fallback
}

function readTextureTheme(): TextureTheme {
  const root = document.documentElement
  const style = window.getComputedStyle(root)
  const dark = root.classList.contains('dark')

  return {
    surfaceElevated: readToken(style, '--color-surface-elevated', dark ? 'rgb(14 24 40)' : '#fbfbfd'),
    text: readToken(style, '--color-text', dark ? '#f5f5f7' : '#1d1d1f'),
    border: readToken(style, '--color-border-strong', dark ? 'rgb(255 255 255 / 0.12)' : 'rgb(29 29 31 / 0.12)'),
    dark,
  }
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.arcTo(x + width, y, x + width, y + height, safeRadius)
  context.arcTo(x + width, y + height, x, y + height, safeRadius)
  context.arcTo(x, y + height, x, y, safeRadius)
  context.arcTo(x, y, x + width, y, safeRadius)
  context.closePath()
}

function loadImage(src: string | null) {
  if (!src) return Promise.resolve<HTMLImageElement | null>(null)

  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (image.naturalWidth - sourceWidth) / 2
  const sourceY = (image.naturalHeight - sourceHeight) / 2

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

function parseColorChannels(color: string) {
  const hex = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1]
  if (hex) {
    const normalized = hex.length === 3 ? hex.split('').map((value) => value + value).join('') : hex
    return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16))
  }

  const rgb = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (!rgb) return null
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
}

function resolveTitleColor(background: string, theme: TextureTheme) {
  const channels = parseColorChannels(background)
  if (!channels) return theme.text

  const [red = 0, green = 0, blue = 0] = channels
  const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255
  return luminance > 0.58 ? '#17181c' : '#f7f7f9'
}

function wrapTitle(context: CanvasRenderingContext2D, title: string, maxWidth: number) {
  const characters = Array.from(title.replace(/\s+/g, ' ').trim())
  const lines: string[] = []
  let line = ''

  for (const character of characters) {
    const candidate = line + character
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = character
    } else {
      line = candidate
    }
  }

  if (line) lines.push(line)
  return lines
}

function fitTitle(context: CanvasRenderingContext2D, title: string, maxWidth: number, maxHeight: number) {
  for (let fontSize = 108; fontSize >= 32; fontSize -= 4) {
    context.font = `900 ${fontSize}px "Zhaohua Display", "Noto Serif SC", "Songti SC", serif`
    const lines = wrapTitle(context, title, maxWidth)
    const lineHeight = fontSize * 1.18

    if (lines.length * lineHeight <= maxHeight) {
      return { fontSize, lineHeight, lines }
    }
  }

  const fontSize = 30
  context.font = `900 ${fontSize}px "Zhaohua Display", "Noto Serif SC", "Songti SC", serif`
  return {
    fontSize,
    lineHeight: fontSize * 1.18,
    lines: wrapTitle(context, title, maxWidth),
  }
}

function drawTitleCover(
  context: CanvasRenderingContext2D,
  article: ArticleCardVm,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: TextureTheme,
) {
  const background = article.cover.color || theme.surfaceElevated
  context.fillStyle = background
  context.fillRect(x, y, width, height)

  const maxWidth = width - TITLE_HORIZONTAL_PADDING * 2
  const maxHeight = height - TITLE_VERTICAL_PADDING * 2
  const fitted = fitTitle(context, article.titleText, maxWidth, maxHeight)
  const totalHeight = fitted.lines.length * fitted.lineHeight
  const firstBaseline = y + (height - totalHeight) / 2 + fitted.fontSize

  context.fillStyle = resolveTitleColor(background, theme)
  context.font = `900 ${fitted.fontSize}px "Zhaohua Display", "Noto Serif SC", "Songti SC", serif`
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'

  fitted.lines.forEach((line, index) => {
    context.fillText(line, x + width / 2, firstBaseline + index * fitted.lineHeight)
  })
}

async function createArticleMenuTexture(article: ArticleCardVm, theme: TextureTheme) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT

  if (!context) return canvas

  context.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)
  context.save()
  roundedRect(
    context,
    CARD_INSET,
    CARD_INSET,
    TEXTURE_WIDTH - CARD_INSET * 2,
    TEXTURE_HEIGHT - CARD_INSET * 2,
    CARD_RADIUS,
  )
  context.clip()

  const contentX = CARD_INSET
  const contentY = CARD_INSET
  const contentWidth = TEXTURE_WIDTH - CARD_INSET * 2
  const contentHeight = TEXTURE_HEIGHT - CARD_INSET * 2
  const coverImage = article.cover.hasImage ? await loadImage(article.cover.src) : null

  if (coverImage) {
    drawImageCover(context, coverImage, contentX, contentY, contentWidth, contentHeight)
  } else {
    drawTitleCover(context, article, contentX, contentY, contentWidth, contentHeight, theme)
  }

  context.restore()
  context.save()
  roundedRect(
    context,
    CARD_INSET + 0.5,
    CARD_INSET + 0.5,
    TEXTURE_WIDTH - CARD_INSET * 2 - 1,
    TEXTURE_HEIGHT - CARD_INSET * 2 - 1,
    CARD_RADIUS,
  )
  context.strokeStyle = theme.border
  context.lineWidth = 1
  context.stroke()
  context.restore()

  return canvas
}

export async function createArticleMenuTextureItems(
  items: ArticleCardVm[],
  additionalFontText = '',
): Promise<ArticleMenuTextureItem[]> {
  const theme = readTextureTheme()

  if (document.fonts) {
    const requiredFontText = [
      ...items.map((article) => article.titleText),
      additionalFontText,
    ].join('') || ' '

    await Promise.allSettled([
      document.fonts.load('900 80px "Zhaohua Display"', requiredFontText),
    ])
  }

  const textures = await Promise.all(items.map((article) => createArticleMenuTexture(article, theme)))

  return items.map((article, index) => ({
    article,
    texture: textures[index] as HTMLCanvasElement,
  }))
}
