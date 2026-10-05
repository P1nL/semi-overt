import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { HEADER_DOCK_LAYOUT_EVENT } from '../src/shared/utils/headerDockLayout.ts'
import { advanceDraftBungee, BUNGEE_EQUILIBRIUM, BUNGEE_REST_LENGTH, createDraftBungee, DRAFT_STAR_PATH, draftBungeeVisual, getDraftContentOpacity } from '../src/features/draft-box/model/draftBungee.ts'
import { getDraftPanelPlacement, getDraftStarPath } from '../src/features/draft-box/model/draftStarMorph.ts'

test('star uses the supplied four-point path verbatim', () => {
  assert.equal(DRAFT_STAR_PATH, 'M50 0 Q55 45 100 50 Q55 55 50 100 Q45 55 0 50 Q45 45 50 0 Z')
})
test('slack cord allows free fall, then tension reverses velocity before natural settling', () => {
  const state = createDraftBungee(true)
  let peak = 0, rebound = false, lastVelocity = 0, fall = false, time = 0
  while (state.phase === 'bungee' && time < 4000) {
    const before = state.y
    advanceDraftBungee(state, 1000 / 120)
    time += 1000 / 120
    if (before < BUNGEE_REST_LENGTH && state.y < BUNGEE_REST_LENGTH) {
      assert.ok(state.velocity >= lastVelocity)
      fall = true
    }
    if (lastVelocity > 0 && state.velocity < 0) rebound = true
    peak = Math.max(peak, state.y)
    lastVelocity = state.velocity
    assert.equal(state.openness, 0, 'panel must wait until the spring settles')
  }
  assert.ok(fall && rebound)
  assert.ok(peak > BUNGEE_EQUILIBRIUM + 3 && peak < BUNGEE_EQUILIBRIUM + 20)
  assert.ok(time > 550 && time < 1000, 'visible natural settling, not the emergency timeout')
  assert.equal(state.phase, 'expand')
  assert.equal(state.y, BUNGEE_EQUILIBRIUM)
  assert.equal(state.velocity, 0)
})
test('30/60/120Hz simulations converge without changing the final geometry', () => {
  const durations = []
  for (const fps of [30, 60, 120]) {
    const state = createDraftBungee(true)
    let elapsed = 0
    while (state.phase !== 'open' && elapsed < 3000) {
      advanceDraftBungee(state, 1000 / fps); elapsed += 1000 / fps
      assert.ok(Number.isFinite(state.y) && state.y >= 0)
    }
    assert.equal(state.phase, 'open')
    assert.equal(state.openness, 1)
    assert.equal(state.y, BUNGEE_EQUILIBRIUM)
    durations.push(elapsed)
  }
  assert.ok(Math.max(...durations) - Math.min(...durations) < 80)
})
test('closing shrinks the panel first, never shows a cord, then retrieves the star upward', () => {
  const state = createDraftBungee(false)
  let lastY = state.y, sawReturn = false
  for (let frame = 0; frame < 100 && state.phase !== 'closed'; frame++) {
    advanceDraftBungee(state, 16)
    const visual = draftBungeeVisual(state, false)
    assert.equal(visual.lineOpacity, 0)
    if (state.phase === 'collapse') assert.equal(state.y, BUNGEE_EQUILIBRIUM)
    if (state.phase === 'return') {
      sawReturn = true
      assert.equal(state.openness, 0)
      assert.ok(state.y <= lastY)
    }
    lastY = state.y
  }
  assert.ok(sawReturn)
  assert.equal(state.phase, 'closed')
  assert.equal(draftBungeeVisual(state, false).starOpacity, 0)
})
test('reversals retain current star position and panel progress', () => {
  const falling = createDraftBungee(true)
  advanceDraftBungee(falling, 64)
  const closing = createDraftBungee(false, falling)
  assert.equal(closing.phase, 'return')
  assert.equal(closing.y, falling.y)
  advanceDraftBungee(closing, 64)
  const reopening = createDraftBungee(true, closing)
  assert.equal(reopening.y, closing.y)
  assert.equal(reopening.phase, 'bungee')
  const panel = { ...falling, phase: 'expand', openness: 0.45 }
  const collapsed = createDraftBungee(false, panel)
  assert.equal(collapsed.openness, 0.45)
  assert.equal(createDraftBungee(true, collapsed).phase, 'expand')
})

const source = readFileSync(new URL('../src/features/draft-box/ui/DraftBungeeTransition.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const code = ts.transpile(script, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None })
function mountTransition(reduced = false, placement = 'bottom', open = undefined) {
  const props = { placement, open }
  const events = new Map(), mediaEvents = new Map(), frames = new Map()
  let mount, unmount, id = 0, reads = 0, time = 0
  const anchor = { x: placement === 'left' ? 1240 : 120, y: 80 }, parentOffset = { x: 0, y: 0 }
  const kebab = key => String(key).replace(/[A-Z]/g, char => '-' + char.toLowerCase())
  const style = () => {
    const values = new Map()
    return new Proxy({
      getPropertyValue: name => values.get(name) ?? '', getPropertyPriority: () => '',
      setProperty: (name, value) => values.set(name, value), removeProperty: name => values.delete(name),
    }, {
      get: (target, key) => key in target ? target[key] : values.get(kebab(key)) ?? '',
      set: (_, key, value) => { values.set(kebab(key), value); return true },
    })
  }
  class ElementMock {
    style = style(); children = []; inert = false; id = 'header-draft-box'; attributes = new Map()
    get offsetLeft() { return parseFloat(this.style.left) || 0 }
    querySelectorAll() { return [] }
    getBoundingClientRect() {
      reads++
      const width = parseFloat(this.style.width) || 512
      const left = this.offsetLeft + parentOffset.x
      const top = 100 + parentOffset.y + (parseFloat(this.style.marginTop) || 0)
      const maxHeight = Number(this.style.maxHeight.match(/, ([\d.]+)px/)?.[1]) || Infinity
      const height = Math.min(250, maxHeight)
      return { left, right: left + width, top, bottom: top + height, width, height }
    }
    setAttribute(name, value) { this.attributes.set(name, value) }
    closest() { return header }
  }
  const header = { getBoundingClientRect() { reads++; return { bottom: anchor.y } }, addEventListener: (name, fn) => events.set('header:' + name, fn), removeEventListener: name => events.delete('header:' + name) }
  const trigger = { closest: () => header, getAttribute: () => 'header-draft-box', getBoundingClientRect() { reads++; return { left: anchor.x - 20, width: 40, top: anchor.y - 48, height: 40, bottom: anchor.y - 8 } } }
  const node = new ElementMock()
  node.children = [new ElementMock(), new ElementMock()]
  node.children[0].style.opacity = '0.8'
  const document = { hidden: false, querySelectorAll: () => [trigger], addEventListener: (name, fn) => events.set('doc:' + name, fn), removeEventListener: name => events.delete('doc:' + name) }
  const window = { innerWidth: 1280, innerHeight: 900, addEventListener: (name, fn) => events.set('win:' + name, fn), removeEventListener: name => events.delete('win:' + name) }
  const media = { matches: reduced, addEventListener: (name, fn) => mediaEvents.set(name, fn), removeEventListener: name => mediaEvents.delete(name) }
  const state = new Function('defineProps', 'HEADER_DOCK_LAYOUT_EVENT', 'onMounted', 'onBeforeUnmount', 'ref', 'defineOptions', 'advanceDraftBungee', 'BUNGEE_EQUILIBRIUM', 'createDraftBungee', 'DRAFT_STAR_PATH', 'draftBungeeVisual', 'getDraftContentOpacity', 'getDraftPanelPlacement', 'getDraftStarPath', 'ResizeObserver', 'MutationObserver', 'document', 'window', 'matchMedia', 'getComputedStyle', 'HTMLElement', 'requestAnimationFrame', 'cancelAnimationFrame', code + ';return { enter, leave, cancel, overlay, cord, star, shape, shield, releasePlacement, running: () => run, placements };')(
    () => props, HEADER_DOCK_LAYOUT_EVENT, fn => { mount = fn }, fn => { unmount = fn }, value => ({ value }), () => {},
    advanceDraftBungee, BUNGEE_EQUILIBRIUM, createDraftBungee, DRAFT_STAR_PATH, draftBungeeVisual, getDraftContentOpacity, getDraftPanelPlacement, getDraftStarPath, class { observe() {} disconnect() {} }, class { observe() {} disconnect() {} },
    document, window, () => media, () => ({ pointerEvents: 'auto', position: 'absolute', marginTop: '0', borderTopLeftRadius: '28px' }), ElementMock,
    fn => { frames.set(++id, fn); return id }, key => frames.delete(key),
  )
  state.overlay.value = new ElementMock(); state.cord.value = new ElementMock(); state.star.value = new ElementMock(); state.shape.value = new ElementMock()
  state.shield.value = new ElementMock()
  mount()
  const tick = () => { const entry = frames.entries().next().value; if (!entry) return false; frames.delete(entry[0]); time += 16; entry[1](time); return true }
  const settle = () => { let count = 0; while (tick() && count++ < 400) {} assert.ok(count < 400) }
  return { state, props, node, frames, tick, settle, reads: () => reads, document, media, events, mediaEvents, unmount, anchor,
    moveAnchor: (dx, dy, parentDx = dx) => { anchor.x += dx; anchor.y += dy; parentOffset.x += parentDx; parentOffset.y += dy; events.get('header:header-dock-layout')?.() },
  }
}

test('stationary geometry is read only at start and surface handoff, never polled every frame', () => {
  const h = mountTransition(); let entered = 0
  h.state.enter(h.node, () => entered++)
  const reads = h.reads()
  assert.equal(h.node.inert, true)
  assert.equal(h.state.overlay.value.style.visibility, 'visible')
  h.settle()
  assert.equal(h.reads() - reads, 3, 'one final shared-anchor read batch at handoff')
  assert.equal(entered, 1)
  assert.equal(h.node.inert, false)
  assert.equal(h.node.style.transform, '')
  assert.equal(h.node.children[0].style.opacity, '0.8')
  assert.equal(h.state.overlay.value.style.visibility, 'hidden')
  h.unmount()
})

test('closed login/header remount does not animate, measure anchors, or reserve a hit shield', () => {
  const h = mountTransition(false, 'bottom', false)
  let entered = 0, left = 0
  h.state.enter(h.node, () => entered++)
  h.state.leave(h.node, () => left++)
  assert.equal(entered, 1)
  assert.equal(left, 1)
  assert.equal(h.reads(), 0)
  assert.equal(h.frames.size, 0)
  assert.equal(h.state.running(), null)
  assert.equal(h.state.placements.size, 0)
  assert.equal(h.state.overlay.value.style.visibility, 'hidden')
  assert.equal(h.state.shield.value.style.visibility, 'hidden')
  h.unmount()
})

test('first explicit click after a closed remount still plays the original open and close animation', () => {
  const h = mountTransition(false, 'bottom', false)
  h.state.enter(h.node, () => {})
  h.props.open = true
  h.state.enter(h.node, () => {})
  assert.ok(h.frames.size > 0)
  assert.equal(h.state.overlay.value.style.visibility, 'visible')
  h.settle()
  assert.equal(h.node.inert, false)
  h.props.open = false
  h.state.leave(h.node, () => h.state.releasePlacement(h.node))
  assert.ok(h.frames.size > 0)
  h.settle()
  assert.equal(h.state.overlay.value.style.visibility, 'hidden')
  h.unmount()
})

test('detached panels never start a stray animation toward empty coordinates', () => {
  const h = mountTransition(false, 'bottom', true)
  h.node.isConnected = false
  h.state.enter(h.node, () => {})
  assert.equal(h.frames.size, 0)
  assert.equal(h.reads(), 0)
  h.unmount()
})

test('drawer enables appearance only when its actual open state is true', () => {
  const drawer = readFileSync(new URL('../src/features/draft-box/ui/DraftBoxDrawer.vue', import.meta.url), 'utf8')
  assert.match(drawer, /<DraftBungeeTransition :open="modelValue" :appear="modelValue"/)
})

test('the full panel hit area blocks background interaction from first frame through closing', () => {
  const h = mountTransition()
  h.state.enter(h.node, () => {})
  assert.equal(h.node.style.visibility, 'hidden')
  assert.equal(h.state.shield.value.style.visibility, 'visible')
  assert.equal(h.state.shield.value.style.width, h.node.getBoundingClientRect().width + 'px')
  assert.equal(h.state.shield.value.style.height, h.node.getBoundingClientRect().height + 'px')
  for (let i = 0; i < 10; i++) h.tick()
  assert.equal(h.state.shield.value.style.visibility, 'visible')
  h.state.cancel()
  h.state.leave(h.node, () => h.state.releasePlacement(h.node))
  assert.equal(h.state.shield.value.style.visibility, 'visible')
  h.settle()
  assert.equal(h.state.shield.value.style.visibility, 'hidden')
  h.state.enter(h.node, () => {})
  h.settle()
  assert.equal(h.state.shield.value.style.visibility, 'hidden')
  assert.equal(h.node.inert, false)
  h.unmount()
  assert.equal(h.state.shield.value.style.visibility, 'hidden')
})

test('the transition shield is a painted hit blocker, not an outside-click dismissal target', () => {
  assert.match(source, /data-title-effect-occluder data-draft-interaction-shield/)
  const actions = readFileSync(new URL('../src/widgets/app-header/AppHeaderActions.vue', import.meta.url), 'utf8')
  assert.match(actions, /ignore: \['\[data-draft-interaction-shield\]'\]/)
})
test('close during the drop hides cord immediately and never calls the old enter completion', () => {
  const h = mountTransition(); let entered = 0, left = 0
  h.state.enter(h.node, () => entered++)
  for (let i = 0; i < 15; i++) h.tick()
  const y = h.state.running().state.y
  h.state.cancel()
  h.state.leave(h.node, () => { left++; h.state.releasePlacement(h.node) })
  assert.equal(h.state.running().state.y, y)
  assert.equal(h.state.cord.value.style.opacity, '0')
  h.settle()
  assert.equal(entered, 0)
  assert.equal(left, 1)
  assert.equal(h.node.style.marginTop, '')
  h.unmount()
})
test('reopen while shrinking preserves panel progress, and unmount clears every resource', () => {
  const h = mountTransition(false, 'bottom', true); let done = 0
  // Closing requires a real, previously opened panel, not a fresh hidden mount.
  h.state.enter(h.node, () => {})
  h.settle()
  h.props.open = false
  h.state.leave(h.node, () => done++)
  for (let i = 0; i < 5; i++) h.tick()
  const p = h.state.running().state.openness
  h.state.cancel()
  h.props.open = true
  h.state.enter(h.node, () => done++)
  assert.equal(h.state.running().state.openness, p)
  h.unmount()
  assert.equal(done, 0)
  assert.equal(h.frames.size + h.events.size + h.mediaEvents.size + h.state.placements.size, 0)
  assert.equal(h.node.style.transform, '')
  assert.equal(h.node.style.marginTop, '')
})
test('reduced motion skips animation but preserves centered placement', () => {
  const h = mountTransition(true); let done = 0
  h.state.enter(h.node, () => done++)
  h.state.leave(h.node, () => done++)
  assert.equal(done, 2)
  assert.equal(h.frames.size, 0)
  assert.ok(h.reads() > 0)
  const rect = h.node.getBoundingClientRect()
  assert.equal(rect.left + rect.width / 2, 120)
  h.unmount()
})
test('hidden tabs, viewport resize and live reduced-motion changes finish safely', () => {
  for (const reason of ['hidden', 'resize', 'reduced']) {
    const h = mountTransition(); let done = 0
    h.state.enter(h.node, () => done++)
    h.tick()
    if (reason === 'hidden') { h.document.hidden = true; h.events.get('doc:visibilitychange')() }
    if (reason === 'resize') { h.events.get('win:resize')(); h.settle() }
    if (reason === 'reduced') { h.media.matches = true; h.mediaEvents.get('change')() }
    assert.equal(done, 1)
    assert.equal(h.frames.size, 0)
    assert.equal(h.state.overlay.value.style.visibility, 'hidden')
    h.unmount()
  }
})

test('star rests exactly at the measured panel center, with a longer line', () => {
  const h = mountTransition()
  h.state.enter(h.node, () => {})
  const rect = h.node.getBoundingClientRect()
  assert.equal(rect.left + rect.width / 2, 120)
  const current = h.state.running()
  assert.equal(current.state.equilibrium, rect.top + rect.height / 2 - 80)
  assert.ok(current.state.equilibrium > BUNGEE_EQUILIBRIUM * 2)
  h.unmount()
})
test('background morph completes before content groups appear in order', () => {
  const state = createDraftBungee(true, undefined, 260)
  let sawMorph = false, sawReveal = false
  for (let frame = 0; frame < 400 && state.phase !== 'open'; frame++) {
    advanceDraftBungee(state, 16)
    if (state.phase === 'expand') {
      sawMorph = true
      assert.equal(state.content, 0)
      assert.equal(draftBungeeVisual(state, true).starOpacity, 1)
    }
    if (state.phase === 'reveal') {
      sawReveal = true
      assert.equal(state.openness, 1)
      assert.equal(state.y, 260)
      assert.ok(getDraftContentOpacity(state.content, 0) >= getDraftContentOpacity(state.content, 1))
    }
  }
  assert.ok(sawMorph && sawReveal)
  assert.equal(state.phase, 'open')
  assert.equal(getDraftContentOpacity(1, 5), 1)
})
test('panel is never scaled; SVG path itself supplies the growing background', () => {
  const h = mountTransition()
  h.state.enter(h.node, () => {})
  while (h.state.running()?.state.phase === 'bungee') h.tick()
  h.tick()
  assert.equal(h.node.style.transform, 'none')
  assert.equal(h.node.style.background, 'transparent')
  assert.ok(h.state.shape.value.attributes.get('d').includes('Q'))
  assert.ok(h.node.children.every(child => child.style.opacity === '0'))
  h.unmount()
})

test('moving dock shares one anchor with cord, star, SVG board and native panel without restarting physics', () => {
  const h = mountTransition()
  h.state.enter(h.node, () => {})
  for(let i=0;i<10;i++) h.tick()
  const before = {...h.state.running().state}
  const reads = h.reads()
  h.moveAnchor(24, 3, 9)
  assert.equal(h.reads() - reads, 3, 'one shared batch, not one read loop per visual')
  assert.equal(parseFloat(h.state.overlay.value.style.left) + parseFloat(h.state.overlay.value.style.width)/2, h.anchor.x)
  assert.equal(parseFloat(h.state.overlay.value.style.top) + 16, h.anchor.y)
  const rect = h.node.getBoundingClientRect()
  assert.equal(rect.left + rect.width/2, h.anchor.x)
  assert.equal(rect.top, h.anchor.y + 12)
  assert.deepEqual(h.state.running().state, before)
  h.unmount()
})
test('anchor follows during morph and after native handoff, then detaches on final close', () => {
  const h = mountTransition()
  h.state.enter(h.node, () => {})
  while(h.state.running()?.state.phase==='bungee') h.tick()
  const p = h.state.running().state.openness
  h.moveAnchor(-18, 0, -5)
  assert.equal(h.state.running().state.openness, p)
  assert.equal(parseFloat(h.state.overlay.value.style.left) + parseFloat(h.state.overlay.value.style.width)/2, h.anchor.x)
  h.settle()
  const handoff = h.node.getBoundingClientRect()
  assert.equal(handoff.left + handoff.width / 2, h.anchor.x)
  h.moveAnchor(10, 0, 3)
  const rect = h.node.getBoundingClientRect()
  assert.equal(rect.left+rect.width/2,h.anchor.x)
  h.state.leave(h.node,()=>h.state.releasePlacement(h.node))
  h.settle()
  assert.equal(h.events.has('header:header-dock-layout'),false)
  h.unmount()
})

test('full close is deliberately slower: 200ms content, 400ms morph, 400ms retrieval', () => {
  const state = createDraftBungee(false)
  const transitions = []
  let previous = state.phase
  for (let time = 10; time <= 1100 && state.phase !== 'closed'; time += 10) {
    advanceDraftBungee(state, 10)
    if (state.phase !== previous) { transitions.push([state.phase, time]); previous = state.phase }
  }
  assert.equal(transitions[0][0], 'collapse')
  assert.ok(transitions[0][1] >= 200 && transitions[0][1] <= 210)
  assert.equal(transitions[1][0], 'return')
  assert.ok(transitions[1][1] >= 600 && transitions[1][1] <= 620)
  assert.equal(transitions[2][0], 'closed')
  assert.ok(transitions[2][1] >= 1000 && transitions[2][1] <= 1030)
})
test('draft material uses scoped solid surfaces and the SVG morph shares the same tokens', () => {
  const panel = readFileSync(new URL('../src/features/draft-box/ui/DraftBoxDrawer.vue', import.meta.url), 'utf8')
  const theme = readFileSync(new URL('../src/app/styles/theme.css', import.meta.url), 'utf8')
  assert.doesNotMatch(panel, /draft-box-panel surface-1|backdrop-filter: blur/)
  assert.match(panel, /background: var\(--color-draft-panel-bg\)/)
  assert.match(panel, /box-shadow: var\(--shadow-draft-panel\)/)
  assert.match(panel, /draft-box-panel__heading/)
  assert.match(panel, /:deep\(\.draft-create-card\)/)
  assert.match(source, /var\(--color-draft-panel-bg\)/)
  assert.match(source, /var\(--color-draft-panel-border\)/)
  assert.equal((theme.match(/--color-draft-panel-bg:/g) ?? []).length, 2)
})

test('bungee cord remains vertical on the shared axis throughout the fall and rebound', () => {
  const h = mountTransition()
  h.state.enter(h.node, () => {})
  let samples = 0
  while (h.state.running()?.state.phase === 'bungee') {
    const path = h.state.cord.value.attributes.get('d')
    assert.match(path, /^M 0 0 L 0 [\d.e+-]+$/)
    const length = Number(path.slice('M 0 0 L 0 '.length))
    assert.equal(length, Math.max(0, h.state.running().state.y - 13))
    samples++
    h.tick()
  }
  assert.ok(samples > 20)
  h.unmount()
})

test('long drops have a visible rebound and longer settling without changing morph/reveal durations', () => {
  for (const equilibrium of [137, 260, 300]) {
    const state = createDraftBungee(true, undefined, equilibrium)
    let time = 0, peak = 0, rebound = false, reboundMin = Infinity
    while (state.phase === 'bungee' && time < 1500) {
      advanceDraftBungee(state, 10); time += 10
      peak = Math.max(peak, state.y)
      rebound ||= state.velocity < 0
      if (rebound) reboundMin = Math.min(reboundMin, state.y)
    }
    assert.equal(state.phase, 'expand')
    assert.ok(time >= 700 && time < 1200)
    assert.ok(rebound && peak > equilibrium + 20 && peak < equilibrium + 45)
    assert.ok(peak - reboundMin > 25, "upward rebound must be clearly visible")
    let morph = 0, reveal = 0
    while (state.phase === 'expand') { advanceDraftBungee(state, 10); morph += 10 }
    while (state.phase === 'reveal') { advanceDraftBungee(state, 10); reveal += 10 }
    assert.ok(morph >= 460 && morph <= 470)
    assert.ok(reveal >= 520 && reveal <= 530)
  }
})
test('panel restores shared horizontal padding without restoring an uneven trailing gutter', () => {
  const panel = readFileSync(new URL('../src/features/draft-box/ui/DraftBoxDrawer.vue', import.meta.url), 'utf8')
  const list = readFileSync(new URL('../src/features/draft-box/ui/DraftList.vue', import.meta.url), 'utf8')
  assert.match(panel, /rounded-\[var\(--radius-xl\)\] p-4 max-md:fixed/)
  assert.match(list, /padding-right: 0;/)
  assert.match(list, /scrollbar-gutter: auto;/)
})
test('hero scramble lasts 1.5 seconds without speeding up symbol switching', () => {
  const hero = readFileSync(new URL('../src/widgets/hero-section/HeroTitleRing.vue', import.meta.url), 'utf8')
  assert.match(hero, /:duration="1.5" :speed="0.16"/)
})


test('ZEN launches horizontally from the icon center and preserves natural panel height', () => {
  const h = mountTransition(false, 'left')
  h.state.enter(h.node, () => {})
  const current = h.state.running(), rect = h.node.getBoundingClientRect()
  assert.equal(rect.width, 512, 'right-edge buttons must not squeeze panel width')
  assert.equal(rect.right, h.anchor.x - 20 - 12)
  assert.equal(current.scene.sourceX, h.anchor.x - 20)
  assert.equal(current.scene.sourceY, h.anchor.y - 28)
  assert.equal(rect.height, 250)
  assert.equal(current.scene.directionY, 0)
  assert.equal(current.scene.originY, (current.scene.sourceY - rect.top) / rect.height)
  const targetX = current.scene.sourceX + current.scene.directionX * current.state.equilibrium
  const targetY = current.scene.sourceY + current.scene.directionY * current.state.equilibrium
  assert.ok(Math.abs(targetX - (rect.left + rect.width / 2)) < 1e-8)
  assert.equal(targetY, current.scene.sourceY)
  for (let i = 0; i < 12; i++) h.tick()
  const path = h.state.cord.value.attributes.get('d').split(' ').map(Number)
  assert.ok(path[4] < 0, 'cord must extend to the left of its source')
  assert.equal(path[5], 0, 'cord must remain horizontal')
  h.settle()
  assert.equal(h.node.getBoundingClientRect().width, 512)
  assert.equal(h.node.inert, false)
  h.state.leave(h.node, () => h.state.releasePlacement(h.node))
  h.settle()
  assert.equal(h.node.style.left, '')
  assert.equal(h.node.style.width, '')
  h.unmount()
})

test('ZEN reduced motion preserves full-width left placement without animation', () => {
  const h = mountTransition(true, 'left')
  h.state.enter(h.node, () => {})
  const rect = h.node.getBoundingClientRect()
  assert.equal(rect.width, 512)
  assert.equal(rect.right, h.anchor.x - 32)
  assert.equal(h.frames.size, 0)
  h.unmount()
})

test('ZEN close/reopen and viewport refresh retain icon-level horizontal trajectory', () => {
  const h = mountTransition(false, 'left')
  h.state.enter(h.node, () => {})
  for(let i = 0; i < 12; i++) h.tick()
  const distance = h.state.running().state.y
  h.state.cancel()
  h.state.leave(h.node, () => {})
  assert.equal(h.state.running().state.y, distance)
  assert.equal(h.state.cord.value.style.opacity, '0')
  h.state.cancel()
  h.state.enter(h.node, () => {})
  h.events.get('win:resize')()
  assert.equal(h.state.running().scene.directionY, 0)
  assert.equal(h.node.getBoundingClientRect().height, 250)
  h.settle()
  assert.equal(h.node.getBoundingClientRect().width, 512)
  h.unmount()
})


test('ZEN panel avoids viewport edges without moving the star above or below the icon', () => {
  for (const iconY of [52, 300, 800]) {
    const h = mountTransition(false, 'left')
    h.anchor.y = iconY + 28
    h.state.enter(h.node, () => {})
    const current = h.state.running(), rect = h.node.getBoundingClientRect()
    assert.equal(rect.height, 250)
    assert.ok(rect.top >= 12 && rect.bottom <= 888)
    assert.equal(current.scene.directionY, 0)
    assert.equal(rect.top + current.scene.originY * rect.height, iconY)
    while (h.state.running()?.state.phase === 'bungee') {
      const path = h.state.cord.value.attributes.get('d').split(' ')
      assert.equal(Number(path[5]), 0)
      h.tick()
    }
    h.settle()
    h.unmount()
  }
})
