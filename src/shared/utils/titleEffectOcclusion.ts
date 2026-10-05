type PointerPoint = { clientX: number; clientY: number }
type HitDocument = Pick<Document, 'elementsFromPoint'>
const eventHits = new WeakMap<object, { document: HitDocument; blocked: boolean }>()

/** Use painted hit regions (including rounded corners/clipping), not bounding boxes.
 * Check the whole stack: raised cards can overlap even if a title glyph is on top.
 * A single pointer event is shared by all pressure glyph listeners.
 */
export function isTitleEffectOccluded(point: PointerPoint, document: HitDocument): boolean {
  const cached = eventHits.get(point)
  if (cached?.document === document) return cached.blocked
  const blocked = (document.elementsFromPoint?.(point.clientX, point.clientY) ?? [])
    .some(element => !!element.closest('[data-title-effect-occluder]'))
  eventHits.set(point, { document, blocked })
  return blocked
}
