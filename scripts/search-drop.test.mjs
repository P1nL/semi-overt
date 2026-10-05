import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { getSearchDropMotion, getSearchReturnMotion } from '../src/widgets/app-header/model/searchDropMotion.ts'

const source = readFileSync(new URL('../src/widgets/app-header/SearchSuggestions.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const code = ts.transpile(script, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None })
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
function setup(reduced = false) {
  const calls = [], order = [], events = []
  let unmount
  const makeElement = (kind, bottom) => ({
    dataset: kind ? { searchRow: kind } : {},
    offsetTop: kind === 'author' ? 76 : 12, offsetHeight: 64,
    style: { removeProperty() {} },
    getBoundingClientRect() { order.push('read'); return { bottom, top: 100 } },
    animate(frames, options) {
      order.push('write')
      let resolve, reject
      const finished = new Promise((yes, no) => { resolve = yes; reject = no })
      const animation = { finished, cancelled: false, committed: false, commitStyles() { this.committed = true }, cancel() { this.cancelled = true; reject(new Error('cancelled')) }, resolve }
      calls.push({ frames, options, animation, kind })
      return animation
    },
  })
  const article = makeElement('article', 176), author = makeElement('author', 240), node = makeElement(null, 240)
  node.querySelectorAll = () => [article, author]
  node.parentElement = { querySelector: () => ({ getBoundingClientRect() { order.push('read'); return { bottom: 100 } } }) }
  const state = new Function('onBeforeUnmount', 'getSearchDropMotion', 'getSearchReturnMotion', 'getComputedStyle', 'DOMMatrixReadOnly', 'defineProps', 'defineEmits', 'matchMedia', code + ';return { enter, leave, cancel, runs };')(
    callback => { unmount = callback }, getSearchDropMotion, getSearchReturnMotion, () => ({ transform: 'matrix(1, 0, 0, 1, 0, -20)', opacity: '0.8', borderRadius: '20px' }), class { m42 = -20 }, () => ({}), () => (...args) => events.push(args), () => ({ matches: reduced }),
  )
  return { state, node, calls, order, events, unmount: () => unmount() }
}

test('author drops first; article follows and settles above it in under 650ms', () => {
  const author = getSearchDropMotion(140, 'author'), article = getSearchDropMotion(76, 'article')
  assert.equal(author.options.delay, 0)
  assert.equal(article.options.delay, 280)
  assert.ok(author.options.duration < article.options.duration + article.options.delay)
  assert.ok(article.options.duration + article.options.delay < 650)
  assert.equal(article.keyframes.at(-1).borderRadius, '20px 20px 0px 0px')
  assert.equal(author.keyframes.at(-1).borderRadius, '0px 0px 20px 20px')
})
test('free fall accelerates downward with equal gravity for both rows', () => {
  for (const distance of [76, 140]) {
    const motion = getSearchDropMotion(distance, 'author')
    const frames = motion.keyframes.slice(0, 17)
    let lastTravel = -1
    frames.forEach((frame, i) => {
      const y = Number(frame.transform.match(/translate3d\(0, ([\d.e+-]+)px/)[1])
      assert.ok(Math.abs(y + distance * (1 - (i / 16) ** 2)) < 1e-8)
      const travel = distance + y
      assert.ok(travel >= lastTravel)
      lastTravel = travel
    })
    assert.equal(motion.keyframes.at(-1).transform, 'translate3d(0, 0, 0) scale(1, 1)')
  }
})
test('all geometry is read before animations and completion joins both rows', async () => {
  const h = setup(); let done = 0
  h.state.enter(h.node, () => done++)
  assert.deepEqual(h.order, ['read', 'read', 'read', 'write', 'write'])
  assert.equal(h.node.dataset.dropping, 'true')
  h.calls[1].animation.resolve(); await flush()
  assert.equal(done, 0)
  h.calls[0].animation.resolve(); await flush()
  assert.equal(done, 1)
  assert.equal(h.node.dataset.dropping, undefined)
  assert.equal(h.state.runs.size, 0)
  h.unmount()
})
test('rapid close cancels drops and prevents stale completion callbacks', async () => {
  const h = setup(); let entered = 0, left = 0
  h.state.enter(h.node, () => entered++)
  h.state.leave(h.node, () => left++)
  assert.ok(h.calls.slice(0, 2).every(call => call.animation.cancelled && call.animation.committed))
  assert.equal(h.node.inert, true)
  h.calls[2].animation.resolve(); await flush()
  assert.equal(left, 0)
  h.calls[3].animation.resolve(); await flush()
  assert.equal(entered, 0)
  assert.equal(left, 1)
  h.unmount()
})
test('rapid reopen and unmount leave no active animation or stale callback', async () => {
  const h = setup(); let done = 0
  h.state.enter(h.node, () => done++)
  h.state.leave(h.node, () => done++)
  h.state.enter(h.node, () => done++)
  assert.equal(h.node.inert, false)
  h.unmount(); await flush()
  assert.ok(h.calls.every(call => call.animation.cancelled))
  assert.equal(h.state.runs.size, 0)
  assert.equal(done, 0)
})
test('reduced motion skips animation and geometry reads', () => {
  const h = setup(true); let done = 0
  h.state.enter(h.node, () => done++)
  h.state.leave(h.node, () => done++)
  assert.equal(done, 2)
  assert.equal(h.calls.length, 0)
  assert.equal(h.order.length, 0)
  h.unmount()
})
test('article remains first in DOM and keyword updates do not remount the panel', () => {
  assert.ok(source.indexOf('data-search-row="article"') < source.indexOf('data-search-row="author"'))
  assert.doesNotMatch(source, /:key="keyword"|watch\(/)
  assert.match(source, /@keydown.esc.prevent.stop/)
  assert.match(source, /emit\('article'\)/)
  assert.match(source, /emit\('author'\)/)
})

test('return retracts article first, then author, and holds current pose until its turn', () => {
  const pose = { transform: 'matrix(1, 0, 0, 1, 0, -37)', opacity: '0.6', borderRadius: '20px' }
  const article = getSearchReturnMotion(76, 'article', pose)
  const author = getSearchReturnMotion(140, 'author', pose)
  assert.equal(article.options.delay, 0)
  assert.equal(author.options.delay, 80)
  assert.equal(author.options.duration + author.options.delay, 320)
  assert.deepEqual(article.keyframes[0], pose)
  assert.match(author.keyframes.at(-1).transform, /-140px/)
  assert.equal(article.options.fill, 'both')
})
test('closed signal waits for both return animations and is suppressed by reopening', async () => {
  const h = setup()
  h.state.leave(h.node, () => {})
  h.calls[0].animation.resolve(); await flush()
  assert.ok(!h.events.some(([name]) => name === 'closed'))
  h.calls[1].animation.resolve(); await flush()
  assert.equal(h.events.filter(([name]) => name === 'closed').length, 1)
  h.events.length = 0
  h.state.leave(h.node, () => {})
  h.state.enter(h.node, () => {})
  await flush()
  assert.ok(!h.events.some(([name]) => name === 'closed'))
  assert.equal(h.calls.at(-1).frames[0].transform, 'matrix(1, 0, 0, 1, 0, -20)')
  h.unmount()
})
