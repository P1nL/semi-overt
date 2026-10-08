import type { UserProfileVm } from '@/entities/user'

// The same visual hierarchy as ProfileHeader, on a landscape sphere card.
const WIDTH = 960
const HEIGHT = 640
const TEXTURE_SCALE = 2
const INSET = 14
const RADIUS = 38

function image(src: string | null) {
  if (!src) return Promise.resolve<HTMLImageElement | null>(null)
  return new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight)
  const w = width / scale, h = height / scale
  ctx.drawImage(img, (img.naturalWidth - w) / 2, (img.naturalHeight - h) / 2, w, h, x, y, width, height)
}
export function authorCardLines(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, width: number, limit = 2) {
  const lines: string[] = []
  let line = ''
  for (const char of Array.from(text.replace(/\s+/g, ' ').trim())) {
    if (line && ctx.measureText(line + char).width > width) {
      lines.push(line)
      line = char
    } else line += char
  }
  if (line) lines.push(line)
  if (lines.length <= limit) return lines
  const result = lines.slice(0, limit)
  let tail = Array.from(result[limit - 1] ?? '')
  while (tail.length && ctx.measureText(tail.join('') + '…').width > width) tail.pop()
  result[limit - 1] = tail.join('') + '…'
  return result
}
async function texture(profile: UserProfileVm, style: CSSStyleDeclaration) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * TEXTURE_SCALE; canvas.height = HEIGHT * TEXTURE_SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Author card requires a canvas context')
  // Rasterize the logical layout at 2x; never enlarge low-resolution glyph pixels.
  ctx.scale(TEXTURE_SCALE, TEXTURE_SCALE)
  const token = (name: string) => style.getPropertyValue(name).trim()
  const font = token('--font-sans') || 'sans-serif'
  const [background, avatar] = await Promise.all([image(profile.coverUrl), image(profile.avatarUrl)])
  ctx.save()
  ctx.beginPath(); ctx.roundRect(INSET, INSET, WIDTH - INSET * 2, HEIGHT - INSET * 2, RADIUS); ctx.clip()
  ctx.fillStyle = token('--color-surface-elevated'); ctx.fillRect(0, 0, WIDTH, HEIGHT)
  if (background) {
    cover(ctx, background, INSET, INSET, WIDTH - INSET * 2, HEIGHT - INSET * 2)
    const shade = ctx.createLinearGradient(0, 0, 0, HEIGHT)
    shade.addColorStop(0, 'rgba(8,15,34,.08)'); shade.addColorStop(.36, 'rgba(8,15,34,.12)'); shade.addColorStop(1, 'rgba(8,15,34,.82)')
    ctx.fillStyle = shade; ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }
  const ink = background ? token('--color-action-on-primary') : token('--color-text')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `400 25px ${font}`
  const signature = authorCardLines(ctx, profile.signature, WIDTH - 150)
  const signatureHeight = signature.length * 36
  const roleHeight = profile.role ? 36 : 0
  // Bottom-aligned stack, with the avatar immediately above the identity.
  const nameY = HEIGHT - 88 - signatureHeight - roleHeight - 42
  const avatarY = nameY - 115
  ctx.save(); ctx.beginPath(); ctx.arc(WIDTH / 2, avatarY, 65, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = token('--color-surface-elevated'); ctx.fillRect(WIDTH / 2 - 65, avatarY - 65, 130, 130)
  if (avatar) cover(ctx, avatar, WIDTH / 2 - 65, avatarY - 65, 130, 130)
  else {
    ctx.fillStyle = token('--color-text'); ctx.font = `600 48px ${font}`
    ctx.fillText(Array.from(profile.displayName)[0] ?? '?', WIDTH / 2, avatarY)
  }
  ctx.restore()
  ctx.beginPath(); ctx.arc(WIDTH / 2, avatarY, 65, 0, Math.PI * 2); ctx.strokeStyle = token('--color-border'); ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = ink; ctx.font = `700 44px ${font}`
  ctx.fillText(authorCardLines(ctx, profile.displayName, WIDTH - 140, 1)[0] ?? '', WIDTH / 2, nameY)
  ctx.globalAlpha = .82; ctx.font = `400 26px ${font}`
  ctx.fillText(authorCardLines(ctx, `@${profile.username}`, WIDTH - 140, 1)[0] ?? '', WIDTH / 2, nameY + 45)
  ctx.globalAlpha = 1
  let y = nameY + 85
  if (profile.role) {
    ctx.font = `600 21px ${font}`; ctx.fillText(profile.role.label, WIDTH / 2, y); y += roleHeight
  }
  ctx.font = `400 25px ${font}`
  signature.forEach((line, index) => ctx.fillText(line, WIDTH / 2, y + index * 36))
  ctx.restore()
  ctx.beginPath(); ctx.roundRect(INSET + 1, INSET + 1, WIDTH - INSET * 2 - 2, HEIGHT - INSET * 2 - 2, RADIUS)
  ctx.strokeStyle = token('--color-border-strong'); ctx.lineWidth = 2; ctx.stroke()
  return canvas
}
export async function createAuthorMenuTextureItems(profiles: UserProfileVm[]) {
  if (document.fonts) await document.fonts.ready
  const style = getComputedStyle(document.documentElement)
  const textures = await Promise.all(profiles.map(profile => texture(profile, style)))
  return textures.map(texture => ({ texture }))
}
