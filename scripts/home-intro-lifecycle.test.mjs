import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as choreography from '../src/features/home-intro/model/choreography.ts'
import { createFrameLimiter } from '../src/shared/utils/animationFrame.ts'
import * as frequency from '../src/features/home-intro/model/frequency.ts'

const EPOCH = Date.UTC(2026, 9, 5)

const text = readFileSync(new URL('../src/features/home-intro/model/provideHomeIntro.ts', import.meta.url), 'utf8').replaceAll('import.meta.env.DEV', '__DEV__')
const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
async function mount({ reduce = false, seen = false, fonts = true, home = true, hidden = false, debug = false, content = 'ready', storage = new Map(), wallTime = EPOCH, navigation = 'navigate', storageError = '', locks } = {}) {
  const events = new Map(), docEvents = new Map(), mediaEvents = new Map(), timers = new Map(), timerDelays = new Map()
  if(seen) storage.set(frequency.INTRO_FREQUENCY_KEY,JSON.stringify({plays:[wallTime],snoozedUntil:0}))
  const localStorage = {
    getItem(key) { if(storageError==='read') throw Error('storage denied'); return storage.get(key)??null },
    setItem(key,value) { if(storageError==='write') throw Error('storage denied'); storage.set(key,value) },
  }
  let mounted, unmounted, timeline, observer, timerId = 0, timelineCount = 0, now = 0
  const ref = value => ({ value })
  const media = { matches: reduce, addEventListener: (key, fn) => mediaEvents.set(key, fn), removeEventListener: key => mediaEvents.delete(key) }
  const doc = { hidden, fonts: { load: async () => [], check: () => fonts }, documentElement: { removeAttribute() {} }, addEventListener: (key, fn) => docEvents.set(key, fn), removeEventListener: key => docEvents.delete(key) }
  const gsap = { ticker: { fps() { assert.fail('Splash must not change the global GSAP frame rate') } }, timeline(options) {
    timelineCount++
    timeline = { killed: false, options, labels: {}, addLabel(name, seconds) { this.labels[name]=seconds; return this }, to(clock, tween) { this.clock=clock; this.tween=tween; return this }, pause() { return this }, time(seconds) { this.seekedSeconds=seconds; return this }, play() { this.playing=true }, kill() { this.killed=true } }
    return timeline
  } }
  const exports = {}
  vm.runInNewContext(code, {
    exports, URLSearchParams, AbortController, Promise, Map, Math, Object,
    __DEV__: debug, location: { search: debug ? '?intro=debug' : '' }, innerWidth: 1280, innerHeight: 720,
    matchMedia: () => media, document: doc, performance: { now: () => now, getEntriesByType: () => [{type:navigation}] },
    Date: { now: () => wallTime }, navigator: { locks },
    setTimeout: (fn, ms) => setTimeout(fn, ms === 1200 ? 100 : 0), clearTimeout,
    window: { localStorage, setTimeout: (fn,ms) => { timers.set(++timerId, fn); timerDelays.set(timerId,ms); return timerId }, clearTimeout: id => { timers.delete(id); timerDelays.delete(id) }, addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) },
    ResizeObserver: class { constructor(callback) { this.callback=callback; observer=this } observe() {} disconnect() { this.disconnected=true } },
    require: name => {
      if(name==='vue') return { ref, shallowRef: ref, computed: fn => ({get value(){return fn()}}), nextTick: async()=>{}, provide(){}, onMounted: fn => {mounted=fn}, onBeforeUnmount: fn => {unmounted=fn} }
      if(name==='gsap') return {gsap}
      if(name==='./choreography') return choreography
      if(name==='./context') return {homeIntroKey: Symbol('test')}
      if(name==='./frequency') return frequency
      if(name==='@/shared/utils/animationFrame') return {createFrameLimiter}
      throw Error(name)
    },
  })
  const intro=exports.provideHomeIntro(home)
  for(const id of ['eye','home','category','tools','cube']) intro.register(id,()=>({getBoundingClientRect:()=>({left:10,top:20,width:50,height:50})}))
  intro.setContentState(content)
  mounted()
  async function waitForTimeline() {
    for(let attempt=0;attempt<100 && intro.active.value && !timeline;attempt++) await new Promise(resolve=>setTimeout(resolve,2))
  }
  if(content!=='pending') await waitForTimeline()
  else await new Promise(resolve=>setTimeout(resolve,5))
  return {intro, events, docEvents, mediaEvents, media, doc, timers, timerDelays, storage, waitForTimeline, get timeline(){return timeline}, get timelineCount(){return timelineCount}, get observer(){return observer},
    step(time, timestamp = time) { now=timestamp; timeline.clock.time=time; timeline.tween.onUpdate() },
    setWallTime(value) { wallTime=value },
    unmount:()=>unmounted()}
}
for (const refresh of [30, 60, 90, 120, 144, 240]) {
  test(`Splash publishes at most 60fps on ${refresh}Hz input without slowing its clock`,async t=>{
    const h=await mount()
    try {
      h.step(0)
      let updates=0
      for(let frame=1;frame<=refresh*10;frame++) {
        const elapsed=frame*1000/refresh, previous=h.intro.time.value
        h.step(elapsed)
        if(h.intro.time.value!==previous) updates++
        assert.ok(elapsed-h.intro.time.value<1000/60+1000/refresh)
      }
      t.diagnostic(`${refresh}Hz input: ${updates} published updates in 10 seconds`)
      assert.equal(updates,Math.min(refresh,60)*10)
      assert.equal(h.intro.time.value,10000)
      assert.equal(h.timeline.tween.duration,12.76)
    } finally { h.unmount() }
  })
}
test('a slow frame advances to current timeline time without catch-up rendering',async()=>{
  const h=await mount()
  try {
    h.step(0)
    h.step(8)
    assert.equal(h.intro.time.value,0)
    h.step(2000)
    assert.equal(h.intro.time.value,2000)
    h.step(2001)
    assert.equal(h.intro.time.value,2000)
  } finally { h.unmount() }
})
test('debug seeking bypasses the cap and playback resumes without a stale frame budget',async()=>{
  const h=await mount({debug:true})
  try {
    h.step(8000,100)
    h.step(8008,108)
    assert.equal(h.intro.time.value,8000)
    h.intro.seek(12000)
    assert.equal(h.intro.time.value,12000)
    h.intro.seek(1000)
    assert.equal(h.intro.time.value,1000)
    h.intro.play()
    h.step(1001,109)
    assert.equal(h.intro.time.value,1001)
  } finally { h.unmount() }
})
test('completion and skip settle immediately even between scheduled state updates',async()=>{
  for(const reason of ['complete','skip']) {
    const h=await mount()
    try {
      h.step(12750,1000)
      h.step(12758,1008)
      assert.equal(h.intro.time.value,12750)
      if(reason==='complete') h.timeline.options.onComplete()
      else h.intro.finish()
      assert.equal(h.intro.time.value,choreography.HOME_INTRO.end)
      assert.equal(h.intro.active.value,false)
      assert.equal(h.intro.contentLocked.value,false)
    } finally { h.unmount() }
  }
})
test('each Splash instance owns an independent state update budget',async()=>{
  const a=await mount(), b=await mount()
  try {
    a.step(100)
    b.step(100)
    assert.equal(a.intro.time.value,100)
    assert.equal(b.intro.time.value,100)
    a.step(108)
    b.step(108)
    assert.equal(a.intro.time.value,100)
    assert.equal(b.intro.time.value,100)
  } finally { a.unmount(); b.unmount() }
})
test('the splash stays in preparation until article data is ready, then measures the actual cards',async()=>{
  const h=await mount({content:'pending'})
  assert.equal(h.intro.active.value,true)
  assert.equal(h.intro.time.value,-1)
  assert.equal(h.intro.contentLocked.value,false)
  assert.equal(h.timeline,undefined)
  assert.deepEqual([...h.timerDelays.values()],[choreography.HOME_INTRO_PREPARE_TIMEOUT_MS])
  const preparationTimer=[...h.timers.keys()][0]
  h.intro.register('card-0',()=>({getBoundingClientRect:()=>({left:30,top:400,width:500,height:500})}))
  h.intro.setContentState('ready')
  await h.waitForTimeline()
  assert.equal(h.intro.time.value,0)
  assert.equal(h.intro.contentLocked.value,true)
  assert.equal(h.intro.rects.value['card-0'].width,500)
  assert.equal(h.timeline.tween.duration,12.76)
  assert.equal(h.timers.has(preparationTimer),false)
  assert.deepEqual([...h.timerDelays.values()],[choreography.HOME_INTRO_WATCHDOG_MS])
  h.intro.setContentState('ready')
  assert.equal(h.timelineCount,1)
  h.unmount()
})
test('data becoming pending again before the snapshot cannot start an incomplete splash',async()=>{
  const h=await mount({content:'pending'})
  h.intro.setContentState('ready')
  h.intro.setContentState('pending')
  await new Promise(resolve=>setTimeout(resolve,30))
  assert.equal(h.timeline,undefined)
  assert.equal(h.intro.contentLocked.value,false)
  h.intro.setContentState('ready')
  await h.waitForTimeline()
  assert.equal(h.timelineCount,1)
  h.unmount()
})
test('failed or timed-out preparation releases the cover and ignores late successful responses',async()=>{
  for(const reason of ['error','timeout','escape','hidden','unmount']) {
    const h=await mount({content:'pending'})
    if(reason==='error') h.intro.setContentState('error')
    if(reason==='timeout') [...h.timers.values()][0]()
    if(reason==='escape') h.events.get('keydown')({key:'Escape',preventDefault(){}})
    if(reason==='hidden') {h.doc.hidden=true;h.docEvents.get('visibilitychange')()}
    if(reason==='unmount') h.unmount()
    h.intro.setContentState('ready')
    await new Promise(resolve=>setTimeout(resolve,10))
    assert.equal(h.intro.active.value,false,reason)
    assert.equal(h.intro.contentLocked.value,false,reason)
    assert.equal(h.timelineCount,0,reason)
    assert.equal(h.timers.size,0,reason)
    if(reason!=='unmount') h.unmount()
  }
})
test('HomePage reports successful data only after rendering; a valid empty response is also ready',()=>{
  const source=readFileSync(new URL('../src/pages/home/HomePage.vue',import.meta.url),'utf8')
  assert.match(source,/homeQuery.isSuccess.value && homeQuery.data.value\s*\? 'ready' : homeQuery.isError.value \? 'error' : 'pending'/)
  assert.match(source,/state => homeIntro\?\.setContentState\(state\)/)
  assert.match(source,/immediate: true, flush: 'post'/)
  assert.equal(choreography.HOME_INTRO_PREPARE_TIMEOUT_MS,8000)
})
test('normal completion settles visibility and kills the one timeline', async()=>{
  const h=await mount()
  assert.equal(h.intro.active.value,true)
  assert.equal(h.intro.contentLocked.value,true)
  assert.equal(h.intro.time.value,0)
  assert.equal(h.timeline.tween.duration,12.76)
  assert.equal(h.timeline.labels.end,12.76)
  h.timeline.options.onComplete()
  assert.equal(h.intro.active.value,false)
  assert.equal(h.intro.contentLocked.value,false)
  assert.equal(h.intro.time.value,12760)
  assert.equal(h.timeline.killed,true)
  assert.equal(h.observer.disconnected,true)
  assert.deepEqual(JSON.parse(h.storage.get(frequency.INTRO_FREQUENCY_KEY)),{plays:[EPOCH],snoozedUntil:0})
  h.intro.finish(); h.unmount()
  assert.equal(h.events.size+h.docEvents.size+h.mediaEvents.size+h.timers.size,0)
})
test('debug seeking uses real milliseconds across independently timed stages', async()=>{
  const h=await mount({debug:true})
  assert.equal(h.timeline.options.paused,true)
  h.intro.seek(8000)
  assert.equal(h.timeline.seekedSeconds,8)
  assert.equal(h.intro.time.value,choreography.toLogicalTime(8000))
  assert.equal(h.intro.phase.value,'lower-arc')
  h.intro.seek(16000)
  assert.equal(h.timeline.seekedSeconds,12.759)
  h.intro.play()
  assert.equal(h.timeline.playing,true)
  assert.equal(h.intro.paused.value,false)
  h.unmount()
})
test('Esc, hidden document, resize, reduced motion, and watchdog all fail open',async()=>{
  for(const reason of ['escape','hidden','resize','reduce','watchdog']) {
    const h=await mount()
    if(reason==='escape') h.events.get('keydown')({key:'Escape',preventDefault(){}})
    if(reason==='hidden') {h.doc.hidden=true; h.docEvents.get('visibilitychange')()}
    if(reason==='resize') h.events.get('resize')()
    if(reason==='reduce') {h.media.matches=true; h.mediaEvents.get('change')()}
    if(reason==='watchdog') [...h.timers.values()][0]()
    assert.equal(h.intro.active.value,false,reason)
    assert.equal(h.timeline.killed,true,reason)
    h.unmount()
  }
})
test('blocked visits, deep links, history restores, reduced motion and unavailable storage/fonts never strand the cover',async()=>{
  for(const options of [{seen:true},{home:false},{hidden:true},{reduce:true},{fonts:false},{navigation:'back_forward'},{storageError:'read'},{storageError:'write'}]) {
    const h=await mount(options)
    assert.equal(h.intro.active.value,false)
    assert.equal(h.timeline,undefined)
    h.unmount()
  }
})
test('a page loaded in the background does not use quota or start when focused later',async()=>{
  const storage=new Map(), h=await mount({storage,hidden:true})
  h.doc.hidden=false
  h.docEvents.get('visibilitychange')()
  assert.equal(h.timelineCount,0)
  assert.equal(storage.size,0)
  assert.equal(h.intro.active.value,false)
  h.unmount()
})

test('automatic playback follows the 2-hour cooldown and rolling 24-hour two-play cap',async()=>{
  const storage=new Map(), hour=60*60*1000
  for(const [offset,expected] of [[0,true],[hour,false],[2*hour,true],[4*hour,false],[24*hour-1,false],[24*hour,true]]) {
    const h=await mount({storage,wallTime:EPOCH+offset})
    try {
      assert.equal(!!h.timeline,expected,`${offset}ms after first play`)
      const before=storage.get(frequency.INTRO_FREQUENCY_KEY)
      h.intro.finish()
      assert.equal(storage.get(frequency.INTRO_FREQUENCY_KEY),before,'settling must not extend the cooldown')
    } finally { h.unmount() }
  }
})
test('refreshing before animation completion still sees the recorded start',async()=>{
  const storage=new Map(), first=await mount({storage})
  assert.equal(first.intro.active.value,true)
  const refresh=await mount({storage,wallTime:EPOCH+5000})
  assert.equal(refresh.timelineCount,0)
  assert.deepEqual(JSON.parse(storage.get(frequency.INTRO_FREQUENCY_KEY)).plays,[EPOCH])
  first.unmount(); refresh.unmount()
})
test('the 24-hour pause is measured from the skip click rather than the animation start',async()=>{
  const storage=new Map(), h=await mount({storage})
  h.setWallTime(EPOCH+5000)
  h.intro.skip()
  assert.deepEqual(JSON.parse(storage.get(frequency.INTRO_FREQUENCY_KEY)),{plays:[EPOCH],snoozedUntil:EPOCH+5000+frequency.INTRO_SKIP_PAUSE_MS})
  h.unmount()
})
test('skip button and Escape snooze for 24 hours, including during preparation',async()=>{
  for(const content of ['ready','pending']) for(const action of ['button','escape']) {
    const storage=new Map(), h=await mount({storage,content})
    if(action==='button') h.intro.skip()
    else h.events.get('keydown')({key:'Escape',preventDefault(){}})
    assert.equal(h.intro.active.value,false,'skip still settles immediately')
    const record=JSON.parse(storage.get(frequency.INTRO_FREQUENCY_KEY))
    assert.equal(record.snoozedUntil,EPOCH+frequency.INTRO_SKIP_PAUSE_MS)
    assert.equal(record.plays.length,content==='ready'?1:0)
    h.unmount()
    for(const [offset,expected] of [[frequency.INTRO_COOLDOWN_MS,false],[frequency.INTRO_SKIP_PAUSE_MS-1,false],[frequency.INTRO_SKIP_PAUSE_MS,true]]) {
      const revisit=await mount({storage,wallTime:EPOCH+offset})
      assert.equal(!!revisit.timeline,expected,action)
      revisit.unmount()
    }
  }
})
test('failures, automatic completion and passive interruption do not add a 24-hour snooze',async()=>{
  for(const reason of ['complete','hidden','resize','watchdog','error','unmount']) {
    const storage=new Map(), pending=reason==='error', h=await mount({storage,content:pending?'pending':'ready'})
    if(reason==='complete') h.timeline.options.onComplete()
    if(reason==='hidden') {h.doc.hidden=true;h.docEvents.get('visibilitychange')()}
    if(reason==='resize') h.events.get('resize')()
    if(reason==='watchdog') [...h.timers.values()][0]()
    if(reason==='error') h.intro.setContentState('error')
    if(reason==='unmount') h.unmount()
    const record=frequency.parseIntroFrequency(storage.get(frequency.INTRO_FREQUENCY_KEY)??null,EPOCH)
    assert.equal(record.snoozedUntil,0,reason)
    assert.equal(record.plays.length,pending?0:1,reason)
    if(reason!=='unmount') h.unmount()
  }
})
test('development replay bypasses frequency limits without consuming quota or snoozing',async()=>{
  const original=JSON.stringify({plays:[EPOCH-1],snoozedUntil:EPOCH+frequency.INTRO_SKIP_PAUSE_MS})
  const storage=new Map([[frequency.INTRO_FREQUENCY_KEY,original]])
  const h=await mount({storage,debug:true})
  assert.ok(h.timeline)
  h.intro.skip(); h.unmount()
  assert.equal(storage.get(frequency.INTRO_FREQUENCY_KEY),original)
})
test('eligibility is rechecked after preparation against another tab playback or skip',async()=>{
  for(const action of ['play','skip']) {
    const storage=new Map(), h=await mount({storage,content:'pending'})
    storage.set(frequency.INTRO_FREQUENCY_KEY,JSON.stringify(action==='play'?{plays:[EPOCH],snoozedUntil:0}:{plays:[],snoozedUntil:EPOCH+frequency.INTRO_SKIP_PAUSE_MS}))
    h.intro.setContentState('ready')
    await h.waitForTimeline()
    assert.equal(h.timelineCount,0,action)
    assert.equal(h.intro.active.value,false,action)
    h.unmount()
  }
})
test('simultaneous tabs serialize playback claims and preserve explicit skip records',async()=>{
  const storage=new Map(), lockNames=[]
  let queue=Promise.resolve()
  const locks={request(name,callback){lockNames.push(name);const result=queue.then(callback);queue=result.catch(()=>{});return result}}
  const a=await mount({storage,locks,content:'pending'}), b=await mount({storage,locks,content:'pending'})
  a.intro.setContentState('ready'); b.intro.setContentState('ready')
  await Promise.all([a.waitForTimeline(),b.waitForTimeline()])
  assert.equal(a.timelineCount+b.timelineCount,1)
  assert.equal(JSON.parse(storage.get(frequency.INTRO_FREQUENCY_KEY)).plays.length,1)
  const playing=a.intro.active.value?a:b
  playing.intro.skip()
  assert.equal(playing.intro.active.value,false)
  await queue
  assert.equal(JSON.parse(storage.get(frequency.INTRO_FREQUENCY_KEY)).snoozedUntil,EPOCH+frequency.INTRO_SKIP_PAUSE_MS)
  assert.ok(lockNames.length>=2)
  assert.ok(lockNames.every(name=>name===frequency.INTRO_FREQUENCY_KEY))
  a.unmount(); b.unmount()
})
test('cancellation before a queued playback claim does not consume quota',async()=>{
  const storage=new Map(), callbacks=[]
  const locks={request(_name,callback){return new Promise(resolve=>callbacks.push(()=>resolve(callback())))}}
  const h=await mount({storage,locks,content:'pending'})
  h.intro.setContentState('ready')
  for(let attempt=0;attempt<100&&!callbacks.length;attempt++) await new Promise(resolve=>setTimeout(resolve,2))
  assert.equal(callbacks.length,1)
  h.intro.finish()
  callbacks[0]()
  await new Promise(resolve=>setTimeout(resolve,2))
  assert.equal(storage.size,0)
  assert.equal(h.timelineCount,0)
  h.unmount()
})
