import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { draftRubberOffset, draftRawOffset, draftSwipeVelocity, draftSnapFrames, clampDraftOffset, DRAFT_DELETE_WIDTH, DRAFT_HINT_DISTANCE, draftDragIntent, shouldRevealDraftDelete } from '../src/features/draft-box/model/draftSwipe.ts'
const source = readFileSync(new URL('../src/features/draft-box/model/useDraftSwipe.ts', import.meta.url), 'utf8')
const code = ts.transpile(source.replace(/^import .*$/gm, '').replace('export function useDraftSwipe', 'function useDraftSwipe'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None })
function mount(flags = {}) {
  const frames = new Map(), events = new Map(), watchers = [], animations = [], railAnimations = []
  let id = 0, onMount, unmount, claims = 0, renderedX = 0
  const options = Object.fromEntries(Object.entries({ enabled: true, active: true, owner: false, busy: false, ...flags }).map(([key,value]) => [key,{value}]))
  options.claim = () => { claims++; options.owner.value = true }
  const media = key => ({ matches: !!flags[key], events: new Map(), addEventListener(n, fn) { this.events.set(n,fn) }, removeEventListener(n) { this.events.delete(n) } })
  const reduced = media('reduced'), coarse = media('coarse')
  class NodeMock {}
  class ElementMock extends NodeMock {
    focusVisible = false
    matches() { return this.focusVisible }
  }
  const title = new ElementMock(), deletion = new ElementMock()
  title.focus = () => api.keyboardFocus({ target: title })
  const captures = new Set()
  const root = { contains: node => node === title || node === deletion,
    querySelector: () => title, hasPointerCapture: n => captures.has(n),
    setPointerCapture: n => captures.add(n), releasePointerCapture: n => captures.delete(n),
  }
  const content = { style: { transform: 'translate3d(0px, 0, 0)' }, animate(keyframes, settings) {
    renderedX = Number(keyframes[0].transform.match(/translate3d\(([-\d.]+)px/)[1])
    const animation = { keyframes, settings, onfinish: null, cancelled: false, cancel() { this.cancelled = true } }
    animations.push(animation)
    return animation
  } }
  const rail = { style: { transform: 'translate3d(64px, 0, 0)' }, animate(keyframes, settings) {
    const animation = { keyframes, settings, cancelled: false, cancel() { this.cancelled = true } }
    railAnimations.push(animation)
    return animation
  } }
  const window = { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) }
  const create = new Function('computed', 'onBeforeUnmount', 'onMounted', 'ref', 'watch', 'draftRubberOffset', 'draftRawOffset', 'draftSwipeVelocity', 'draftSnapFrames', 'clampDraftOffset', 'DRAFT_DELETE_WIDTH', 'DRAFT_HINT_DISTANCE', 'draftDragIntent', 'shouldRevealDraftDelete', 'window', 'matchMedia', 'getComputedStyle', 'DOMMatrixReadOnly', 'Element', 'Node', 'requestAnimationFrame', 'cancelAnimationFrame', code + ';return useDraftSwipe;')(
    fn => ({get value(){return fn()}}), fn => {unmount=fn}, fn => {onMount=fn}, value => ({value}), (target, fn) => watchers.push({target,fn}),
    draftRubberOffset, draftRawOffset, draftSwipeVelocity, draftSnapFrames, clampDraftOffset, DRAFT_DELETE_WIDTH, DRAFT_HINT_DISTANCE, draftDragIntent, shouldRevealDraftDelete,
    window, q => q.includes('reduced-motion') ? reduced : coarse,
    () => ({ transform: `matrix(1,0,0,1,${renderedX},0)` }), class { constructor(){this.m41=renderedX} }, ElementMock, NodeMock,
    fn => {frames.set(++id,fn);return id}, n => frames.delete(n),
  )
  const api = create(options); api.root.value=root; api.content.value=content; api.rail.value=rail; onMount()
  const event = (x=100,y=40,extra={}) => ({clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true,pointerType:'mouse',timeStamp:0,prevented:false,preventDefault(){this.prevented=true},...extra})
  const set = (key,value) => {
    if(options[key].value===value)return
    options[key].value=value
    for(const watcher of watchers) {
      if(Array.isArray(watcher.target) && watcher.target.includes(options[key]))watcher.fn(watcher.target.map(ref=>ref.value))
      else if(watcher.target===options[key])watcher.fn(value)
    }
  }
  return {api, options, events, frames, animations, rail, railAnimations, captures, title, deletion, root, content, reduced, coarse, unmount, event, set, claims:()=>claims,
    down:(x=100,y=40,extra={})=>{api.prepareClick();api.start(event(x,y,extra))},
    move:(x,y=40,extra={})=>{const e=event(x,y,extra);events.get('pointermove')?.(e);return e},
    up:(x=100,y=40,extra={})=>events.get('pointerup')?.(event(x,y,extra)),
    flush:()=>{for(const [key,fn] of [...frames]){frames.delete(key);fn()}},
    finish:()=>{animations.at(-1)?.onfinish?.()},
    visualX:x=>{renderedX=x},
  }
}
test('intent rejects jitter and vertical scrolling; positions are clamped and threshold is halfway',()=>{
  assert.equal(draftDragIntent(-7,2),'pending')
  assert.equal(draftDragIntent(-20,3),'horizontal')
  assert.equal(draftDragIntent(-4,20),'vertical')
  assert.equal(clampDraftOffset(-999),-64)
  assert.equal(clampDraftOffset(20),0)
  assert.equal(shouldRevealDraftDelete(-31),false)
  assert.equal(shouldRevealDraftDelete(-32),true)
})
test('hover hints only once per panel session and never exposes an actionable delete',()=>{
  const h=mount()
  h.api.hint(h.event())
  assert.equal(h.animations.length,1)
  assert.equal(h.animations[0].settings.duration,720)
  assert.match(h.animations[0].keyframes[1].transform,/-48px/)
  assert.equal(h.api.deleteExposed.value,false)
  h.finish();h.api.hint(h.event())
  assert.equal(h.animations.length,1)
  h.set('active',false);h.set('active',true);h.api.hint(h.event())
  assert.equal(h.animations.length,2)
  h.unmount()
})
test('left drag latches open; leaving does not close it; right drag closes',()=>{
  const h=mount();h.down();const e=h.move(50);h.flush()
  assert.equal(e.prevented,true);assert.equal(h.claims(),1);assert.equal(h.captures.size,1)
  h.up(50);h.finish()
  assert.equal(h.api.revealed.value,true)
  assert.match(h.content.style.transform,/-64px/)
  h.api.leaveHint();assert.equal(h.api.revealed.value,true)
  h.down(100);h.move(155);h.up(155);h.finish()
  assert.equal(h.api.revealed.value,false)
  assert.match(h.content.style.transform,/\(0px/)
  h.unmount()
})
test('short drag springs closed and ordinary click or vertical scroll is not swallowed',()=>{
  const h=mount();h.down();h.move(80);h.up(80);h.finish()
  assert.equal(h.api.revealed.value,false)
  h.down();const vertical=h.move(98,70)
  assert.equal(vertical.prevented,false)
  assert.equal(h.events.has('pointermove'),false)
  h.down();h.up()
  const click={detail:1,preventDefault(){throw Error('ordinary click blocked')},stopImmediatePropagation(){}}
  h.api.captureClick(click)
  h.unmount()
})

test('drag click is suppressed once but a fresh pointerdown allows an intentional delete click',()=>{
  const h=mount();h.down();h.move(30);h.up(30)
  let prevented=0,stopped=0
  const click={detail:1,preventDefault(){prevented++},stopImmediatePropagation(){stopped++}}
  h.api.captureClick(click)
  assert.equal(prevented,1);assert.equal(stopped,1)
  h.api.prepareClick();h.api.captureClick(click)
  assert.equal(prevented,1)
  h.unmount()
})
test('dragging during the hint takes over the visible position rather than jumping',()=>{
  const h=mount();h.api.hint(h.event());h.visualX(-12);h.down()
  assert.equal(h.animations[0].cancelled,true)
  h.move(90);h.flush()
  assert.match(h.content.style.transform,/-22px/)
  h.up(90);h.finish()
  assert.equal(h.api.revealed.value,false)
  h.unmount()
})
test('another row claiming ownership closes the previous row and releases capture',()=>{
  const h=mount();h.down();h.move(20);h.up(20);h.finish()
  assert.equal(h.api.revealed.value,true)
  h.set('owner',false);h.finish()
  assert.equal(h.api.revealed.value,false)
  assert.equal(h.captures.size,0)
  h.unmount()
})
test('keyboard reveals delete, internal focus keeps it open, Escape restores without reopening',()=>{
  const h=mount();h.title.focusVisible=true
  h.api.keyboardFocus({target:h.title});h.finish()
  assert.equal(h.api.deleteExposed.value,true)
  h.api.focusout({relatedTarget:h.deletion})
  assert.equal(h.api.revealed.value,true)
  let stopped=false
  h.api.keydown({key:'Escape',preventDefault(){},stopPropagation(){stopped=true}});h.finish()
  assert.equal(stopped,true);assert.equal(h.api.revealed.value,false)
  h.unmount()
})
test('nondeletable/busy rows do not hint or drag; coarse pointer exposes direct delete',()=>{
  for(const flags of [{enabled:false},{busy:true}]){
    const h=mount(flags);h.api.hint(h.event());h.down()
    assert.equal(h.animations.length,0);assert.equal(h.events.has('pointermove'),false)
    h.unmount()
  }
  const h=mount({coarse:true});h.api.hint(h.event());h.down()
  assert.equal(h.api.deleteExposed.value,true)
  assert.equal(h.events.has('pointermove'),false)
  assert.equal(h.animations.length,0)
  h.unmount()
})
test('reduced motion skips hints and snapping animation but keeps explicit gestures usable',()=>{
  const h=mount({reduced:true});h.api.hint(h.event());h.down();h.move(30);h.up(30)
  assert.equal(h.animations.length,0)
  assert.equal(h.api.deleteExposed.value,true)
  assert.match(h.content.style.transform,/-64px/)
  h.unmount()
})
test('cancel, panel close, permission changes and unmount clean up gestures and animations',()=>{
  const h=mount();h.down();h.move(30)
  h.events.get('pointercancel')(h.event());h.finish()
  assert.equal(h.captures.size,0);assert.equal(h.api.revealed.value,false)
  h.down();h.move(20);h.set('active',false)
  assert.equal(h.frames.size,0);assert.equal(h.events.has('pointermove'),false)
  h.set('active',true);h.down();h.move(20);h.up(20);h.set('enabled',false)
  assert.equal(h.api.deleteExposed.value,false)
  h.unmount()
  assert.equal(h.events.size+h.frames.size+h.reduced.events.size+h.coarse.events.size,0)
  assert.ok(h.animations.every(animation=>animation.cancelled))
})
test('markup keeps hit area stationary, hides inactive actions, and wires single-owner state',()=>{
  const item=readFileSync(new URL('../src/features/draft-box/ui/DraftListItem.vue',import.meta.url),'utf8')
  const list=readFileSync(new URL('../src/features/draft-box/ui/DraftList.vue',import.meta.url),'utf8')
  const drawer=readFileSync(new URL('../src/features/draft-box/ui/DraftBoxDrawer.vue',import.meta.url),'utf8')
  assert.match(item,/ref="root"/);assert.match(item,/ref="content"/)
  assert.match(item,/:inert="!deleteExposed"/)
  assert.match(item,/:disabled="deleting \|\| !deleteExposed"/)
  assert.match(item,/@click.capture="captureClick"/)
  assert.match(item,/touch-action: pan-y/)
  assert.match(item,/overflow: hidden/)
  assert.match(list,/@claim="swipeOwnerId = String\(item.id\)"/)
  assert.match(drawer,/:active="modelValue"/)
})

test('rubber edges resist overscroll, stay bounded and invert without a takeover jump',()=>{
  for(const raw of [-10000,-100,-64,-32,0,12,10000]){
    const mapped=draftRubberOffset(raw)
    assert.ok(mapped > -96 && mapped < 32)
    assert.ok(Math.abs(draftRawOffset(mapped)-raw)<1e-6)
  }
  assert.ok(draftRubberOffset(-100)>-100)
  assert.equal(draftRubberOffset(-32),-32)
})
test('recent flick velocity controls direction; stale samples cannot fling a paused row',()=>{
  const samples=[{time:0,offset:0},{time:20,offset:-12}]
  assert.equal(draftSwipeVelocity(samples,25),-600)
  assert.equal(draftSwipeVelocity(samples,150),0)
  assert.equal(draftSwipeVelocity([{time:0,offset:0},{time:1,offset:-100}],1),-1500)
  assert.equal(shouldRevealDraftDelete(-12,-600),true)
  assert.equal(shouldRevealDraftDelete(-52,600),false)
  assert.equal(shouldRevealDraftDelete(-12,0),false)
})
test('sampled spring starts at the current position and lands exactly on its target',()=>{
  for(const velocity of [0,-600,600]){
    const spring=draftSnapFrames(-12,-64,velocity)
    assert.equal(spring.positions[0],-12)
    assert.equal(spring.positions.at(-1),-64)
    assert.ok(spring.positions.every(Number.isFinite))
    assert.equal(spring.duration,velocity ? 400:300)
  }
})
test('short quick flick opens, quick reversal closes, but a paused short drag returns',()=>{
  const h=mount();h.down(100,40,{timeStamp:0});h.move(88,40,{timeStamp:20});h.up(88,40,{timeStamp:25});h.finish()
  assert.equal(h.api.revealed.value,true)
  h.down(100,40,{timeStamp:100});h.move(112,40,{timeStamp:120});h.up(112,40,{timeStamp:125});h.finish()
  assert.equal(h.api.revealed.value,false)
  h.down(100,40,{timeStamp:200});h.move(88,40,{timeStamp:220});h.up(88,40,{timeStamp:400});h.finish()
  assert.equal(h.api.revealed.value,false)
  h.unmount()
})
test('rail follows hint and spring frames and is cancelled together on interruption',()=>{
  const h=mount();h.api.hint(h.event())
  assert.equal(h.railAnimations[0].settings.duration,720)
  assert.match(h.railAnimations[0].keyframes[1].transform,/16px/)
  h.visualX(-10);h.down()
  assert.equal(h.railAnimations[0].cancelled,true)
  assert.match(h.rail.style.transform,/54px/)
  h.move(60);h.up(60)
  assert.equal(h.railAnimations.at(-1).keyframes.length,37)
  h.finish()
  assert.match(h.rail.style.transform,/\(0px/)
  h.unmount()
  assert.ok(h.railAnimations.every(animation=>animation.cancelled))
})
test('full width drag only exposes the action; it never commits a deletion',()=>{
  const h=mount();h.down();h.move(-500);h.flush()
  const x=Number(h.content.style.transform.match(/translate3d\(([-\d.]+)px/)[1])
  assert.ok(x>-96 && x<-64)
  h.up(-500);h.finish()
  assert.equal(h.api.revealed.value,true)
  assert.match(h.content.style.transform,/-64px/)
  assert.doesNotMatch(source,/onCommit|emit\(['"]delete/)
  h.unmount()
})

test('hover reveals three quarters and icon-only deletion uses a stable red background',()=>{
  assert.equal(DRAFT_HINT_DISTANCE,DRAFT_DELETE_WIDTH * 0.75)
  const item=readFileSync(new URL('../src/features/draft-box/ui/DraftListItem.vue',import.meta.url),'utf8')
  const theme=readFileSync(new URL('../src/app/styles/theme.css',import.meta.url),'utf8')
  assert.doesNotMatch(item,/<span>删除<\/span>/)
  assert.match(item,/aria-label="删除文章"/)
  assert.doesNotMatch(item,/draft-swipe-delete:hover/)
  assert.doesNotMatch(theme,/--color-draft-delete-hover:/)
  assert.match(theme,/--color-draft-delete-bg: color-mix\(in srgb, var\(--color-danger\) 62%, var\(--color-brand-logo-bg\)\)/)
})
