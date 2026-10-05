import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { isTitleEffectOccluded } from '../src/shared/utils/titleEffectOcclusion.ts'
const point = () => ({ clientX: 90, clientY: 120 })
const plain = { closest: () => null }
const blocker = { closest: selector => selector === '[data-title-effect-occluder]' ? {} : null }
test('draft panel and raised card block text even when a title glyph is first in hit stack', () => {
  for (const stack of [[blocker, plain], [plain, blocker]]) {
    assert.equal(isTitleEffectOccluded(point(), { elementsFromPoint: () => stack }), true)
  }
})
test('uncovered text and empty rounded corners stay interactive', () => {
  for (const stack of [[], [plain]]) assert.equal(isTitleEffectOccluded(point(), { elementsFromPoint: () => stack }), false)
})
test('all glyph listeners share one hit test per event but new events refresh it', () => {
  let calls = 0, covered = true
  const document = { elementsFromPoint: () => { calls++; return covered ? [blocker] : [plain] } }
  const event = point()
  for (let i = 0; i < 8; i++) assert.equal(isTitleEffectOccluded(event, document), true)
  assert.equal(calls, 1)
  covered = false
  assert.equal(isTitleEffectOccluded(point(), document), false)
  assert.equal(calls, 2)
})
test('only actual draft and card surfaces carry the blocker marker', () => {
  for (const path of ['../src/features/draft-box/ui/DraftBoxDrawer.vue', '../src/widgets/home-showcase/HomeShowcaseCard.vue']) {
    assert.match(readFileSync(new URL(path, import.meta.url), 'utf8'), /data-title-effect-occluder/)
  }
  const rail = readFileSync(new URL('../src/widgets/home-showcase/HomeShowcaseRail.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(rail, /data-title-effect-occluder/)
})
