import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { HOME_INTRO as T, glyphStart, riseWindow, introPhase, shouldPlayIntro, introEmoji, gazeAt, fromViewportBottom, progress, leftToRightRanks } from '../src/features/home-intro/model/choreography.ts'
import { resolveDarkPreference } from '../src/shared/utils/themePreference.ts'
import { coveringRadius, radialRevealEase, RADIAL_REVEAL_DURATION } from '../src/shared/utils/radialReveal.ts'
import { eyeOpeningPath } from '../src/shared/utils/snoopyEye.ts'
import { getStorageItem } from '../src/shared/utils/storage.ts'
import { HOME_INTRO_DURATION_MS, HOME_INTRO_WATCHDOG_MS, INTRO_MOTION as M, toPlaybackTime, toLogicalTime } from '../src/features/home-intro/model/choreography.ts'

test('individually timed beats finish below sixteen seconds with watchdog headroom', () => {
  assert.equal(HOME_INTRO_DURATION_MS, 12760)
  assert.ok(HOME_INTRO_DURATION_MS <= 16000)
  assert.ok(HOME_INTRO_WATCHDOG_MS >= HOME_INTRO_DURATION_MS + 2500)
  assert.equal(toPlaybackTime(T.end), 12760)
  assert.equal(toLogicalTime(12760), T.end)
  assert.equal(toPlaybackTime(-1), -1)
  for (const logical of Object.values(T)) {
    assert.ok(Math.abs(toLogicalTime(toPlaybackTime(logical)) - logical) < 1e-9)
    assert.equal(toPlaybackTime(logical), logical)
  }
  for (let i=0;i<11;i++) {
    const {start,duration}=riseWindow(i,11)
    assert.ok(toPlaybackTime(start+duration)<=T.end)
  }
})

test('theme resolves explicit false before system preference and safely ignores invalid storage', () => {
  for (const system of [true, false]) {
    assert.equal(resolveDarkPreference('true', system), true)
    assert.equal(resolveDarkPreference('false', system), false)
    for (const raw of [null, '', '{}', 'null', 'invalid']) assert.equal(resolveDarkPreference(raw, system), system)
  }
})
test('inaccessible storage reads use the caller fallback without blocking startup', () => {
  assert.equal(getStorageItem({getItem(){throw Error('SecurityError')}},'now.darkMode',true),true)
  assert.equal(getStorageItem({getItem(){return 'false'}},'now.darkMode',true),false)
})
test('pre-mount theme agrees with store, including inaccessible storage', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  for (const system of [true, false]) for (const raw of [null, 'true', 'false', 'bad', 'denied']) {
    let dark
    const root = { classList: { toggle(_, value) { dark = value } }, style: {}, setAttribute() {}, removeAttribute() {} }
    const matchMedia = query => ({ matches: query.includes('color-scheme') ? system : false })
    const context = { document: { documentElement: root }, matchMedia, location: { pathname: '/article/1' }, window: { matchMedia, localStorage: { getItem() { if(raw === 'denied') throw Error('denied'); return raw } }, sessionStorage: { getItem: () => null } } }
    vm.runInNewContext(script, context)
    assert.equal(dark, resolveDarkPreference(raw === 'denied' ? null : raw, system))
  }
})
test('initial-home policy excludes frequency-blocked visits, deep links and reduced motion', () => {
  assert.equal(shouldPlayIntro(true, false, false), true)
  assert.equal(shouldPlayIntro(true, true, false), false)
  assert.equal(shouldPlayIntro(false, false, false, true), false)
  assert.equal(shouldPlayIntro(true, true, false, true), true)
  assert.equal(shouldPlayIntro(true, false, true, true), false)
})
test('closed eye measures 85 units inside the 100-unit disc, fully open matches original path', () => {
  assert.equal(eyeOpeningPath(0), 'M 7.5 50 Q 50 50 92.5 50 Q 50 50 7.5 50 Z')
  assert.equal(eyeOpeningPath(1), 'M 7.5 50 Q 50 0 92.5 50 Q 50 100 7.5 50 Z')
  assert.equal(eyeOpeningPath(-1), eyeOpeningPath(0))
  assert.equal(eyeOpeningPath(9), eyeOpeningPath(1))
})
test('radial reveal reaches every corner without slowing the normal theme switch', () => {
  for (const [w,h] of [[1280,720],[390,844],[1920,1080]]) for(const [x,y] of [[w/2,h*.2],[0,0],[w,h]]) {
    const r=coveringRadius(x,y,w,h)
    for(const [cx,cy] of [[0,0],[w,0],[w,h],[0,h]]) assert.ok(r >= Math.hypot(cx-x,cy-y))
  }
  assert.equal(T.revealed - T.open, 1440)
  assert.equal(RADIAL_REVEAL_DURATION, 760)
  assert.equal(radialRevealEase(0),0)
  assert.equal(radialRevealEase(1),1)
  let previous=0
  for(let i=0;i<=100;i++){const p=radialRevealEase(i/100);assert.ok(p>=previous);previous=p}
})
test('upper letters pair from eye outward and finish before lower arc', () => {
  for(let rank=1;rank<=4;rank++) {
    const a=glyphStart(4-rank,9,4,false), b=glyphStart(4+rank,9,4,false)
    assert.equal(a,b)
    assert.equal(a,T.upper+(rank-1)*M.upperStagger)
    assert.ok(a+M.glyphWrite+M.glyphWeight<=T.lower)
  }
})
test('lower arms start together at seams, overlap, and the letter eye resolves last', () => {
  const starts=Array.from({length:9},(_,i)=>glyphStart(i,9,4,true))
  for(let i=0;i<4;i++) assert.equal(starts[i],starts[8-i])
  assert.equal(starts[1]-starts[0],360)
  assert.ok(starts[1]<starts[0]+M.emoji)
  assert.equal(Math.max(...starts),starts[4])
  assert.ok(starts[4]+M.emoji<=T.rise)
  assert.equal(introEmoji(4,0),introEmoji(4,0))
  assert.notEqual(introEmoji(4,0),introEmoji(4,M.emojiTick))
})
test('the cube leads by 600ms and each card rises quickly at a fixed duration', () => {
  assert.equal(T.cards-T.rise,600)
  assert.ok(T.cubeReady>T.rise)
  assert.equal(riseWindow(1,11).start-riseWindow(0,11).start,120)
  for(const count of [1,5,11,40]) {
    let previous=-1
    for(let i=0;i<count;i++) {
      const {start,duration}=riseWindow(i,count)
      assert.ok(start>previous)
      assert.ok(start+duration<=T.end)
      assert.ok(start>=T.cards)
      assert.equal(duration,800)
      assert.equal(progress(T.end,start,duration),1)
      previous=start
    }
  }
  assert.equal(riseWindow(0,11).start+riseWindow(0,11).duration,11560)
  assert.equal(riseWindow(10,11).start+riseWindow(10,11).duration,T.end)
  assert.ok(fromViewportBottom(400,720)+400>720)
})
test('phase boundaries and gaze are deterministic and fully settle', () => {
  assert.equal(introPhase(-1),'prepare')
  for(const [time,phase] of [[0,'outline'],[T.open,'open'],[T.revealed,'look-up'],[T.home,'header'],[T.upper,'upper-arc'],[T.lower,'lower-arc'],[T.rise,'cube-rise'],[T.cards,'cards-rise'],[T.end,'complete']]) assert.equal(introPhase(time),phase)
  assert.equal(gazeAt(1200),0)
  assert.ok(gazeAt(T.home)<0)
  assert.equal(gazeAt(T.end),0)
})
test('all nine emoji slots have disjoint frame pools, including repeated letters and eye', () => {
  const all = []
  for(let slot=0;slot<9;slot++) for(let frame=0;frame<8;frame++) all.push(introEmoji(slot,frame*M.emojiTick))
  assert.equal(new Set(all).size,72)
  for(let time=T.lower;time<T.rise;time+=31) {
    const visible=[]
    for(let slot=0;slot<9;slot++) {
      const elapsed=time-glyphStart(slot,9,4,true)
      if(elapsed>=0 && elapsed<M.emoji) visible.push(introEmoji(slot,elapsed))
    }
    assert.equal(new Set(visible).size,visible.length,`duplicate at ${time}`)
  }
})
test('emoji overlay preserves the real letter slot and never disables its depth treatment', () => {
  const source=readFileSync(new URL('../src/widgets/hero-section/HeroTitleRing.vue',import.meta.url),'utf8')
  assert.match(source,/class="hero-glyph-content"/)
  assert.match(source,/\.hero-intro-emoji \{ position: absolute; inset: 0;/)
  assert.match(source,/introEmoji\(index % halfCount,/)
  assert.match(source,/element\.style\.opacity = String\(pose\.opacity\)/)
  assert.match(source,/element\.style\.filter = 'blur\(' \+ pose\.blur \+ 'px\)'/)
  assert.doesNotMatch(source,/const settle = introActive/)
})
test('category pop stays fast and emits during its first stretch; the liquid split stays slow', () => {
  assert.equal(M.categoryPop,180)
  assert.equal(T.seedDetached-T.seed,850)
  assert.equal(T.capsule-T.seedDetached,1180)
  assert.ok(T.category<T.seed && T.seed<T.category+M.categoryPop)
  assert.ok(T.capsule+M.iconDelay+M.iconSpread+M.iconFade<=T.upper)
})
test('all beats after release move earlier together, without changing their own tempo',()=>{
  const previous={seedDetached:4440,capsule:5620,capsuleReady:6320,upper:6460,lower:7720,rise:10400,cubeReady:11750,cards:11000,end:13000}
  for(const [key,time] of Object.entries(previous)) assert.equal(T[key],time-240)
  assert.equal(T.category,3260)
  assert.equal(T.seed,3350)
})
test('card order follows physical left edges, including a negative-overlap rail', () => {
  assert.deepEqual(leftToRightRanks([12,-4,-20]),[2,1,0])
  assert.deepEqual(leftToRightRanks([0,100,200]),[0,1,2])
  assert.deepEqual(leftToRightRanks([0,0,10]),[0,1,2])
})
