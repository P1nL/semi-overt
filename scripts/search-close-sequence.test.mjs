import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createSearchCloseSequence } from '../src/widgets/app-header/model/searchCloseSequence.ts'
function setup() {
  const actions = []
  const controller = createSearchCloseSequence({ retract: () => actions.push('rows'), collapse: restore => actions.push(['bar', restore]) })
  return { controller, actions }
}
test('outside click preserves bar until rows finish; repeated closes do not restart', () => {
  const h = setup()
  h.controller.request(true)
  h.controller.request(true)
  assert.deepEqual(h.actions, ['rows'])
  h.controller.complete()
  assert.deepEqual(h.actions, ['rows', ['bar', false]])
  h.controller.complete()
  assert.equal(h.actions.length, 2)
})
test('Escape restores focus after retraction; reopening cancels stale close', () => {
  const h = setup()
  h.controller.request(true)
  h.controller.request(true, { restoreFocus: true })
  h.controller.complete()
  assert.deepEqual(h.actions.at(-1), ['bar', true])
  h.controller.request(true, { restoreFocus: true })
  h.controller.cancel()
  const count = h.actions.length
  h.controller.complete()
  assert.equal(h.actions.length, count)
  h.controller.request(false)
  assert.deepEqual(h.actions.at(-1), ['bar', false])
})
test('empty search and explicit immediate teardown do not wait for row animation', () => {
  const h = setup()
  h.controller.request(false)
  assert.deepEqual(h.actions, [['bar', false]])
  h.controller.request(true)
  h.controller.request(true, { immediate: true })
  assert.deepEqual(h.actions.at(-1), ['bar', false])
  const count = h.actions.length
  h.controller.complete()
  assert.equal(h.actions.length, count)
})
test('header wires completed rows to collapse and keeps retracting rows unclipped', () => {
  const source = readFileSync(new URL('../src/widgets/app-header/AppHeader.vue', import.meta.url), 'utf8')
  assert.match(source, /@closed="onSuggestionsClosed"/)
  assert.match(source, /showDropdown \|\| searchPanelLeaving \|\| searchClosing/)
  assert.match(source, /duration: value \? 360 : 240/)
  assert.match(source, /@click="onSearchButtonClick"/)
  assert.match(source, /searchCloseSequence.cancel\(\)/)
  assert.equal((source.match(/closeSearch\(\{ immediate: true \}\)/g) ?? []).length, 0)
  assert.equal((source.match(/clearSearchOnCollapse = true/g) ?? []).length, 2)
})
