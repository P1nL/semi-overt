import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import {
  INTRO_FREQUENCY_KEY, INTRO_COOLDOWN_MS, INTRO_WINDOW_MS, INTRO_MAX_PLAYS, INTRO_SKIP_PAUSE_MS,
  parseIntroFrequency, readIntroFrequency, canAutoPlayIntro, claimIntroPlayback, snoozeIntroPlayback,
} from '../src/features/home-intro/model/frequency.ts'

const NOW=Date.UTC(2026,9,5), HOUR=60*60*1000
const record=(plays=[],snoozedUntil=0)=>JSON.stringify({plays,snoozedUntil})
function memory(raw=null) {
  let value=raw,writes=0
  return {getItem(key){assert.equal(key,INTRO_FREQUENCY_KEY);return value},setItem(key,next){assert.equal(key,INTRO_FREQUENCY_KEY);value=next;writes++},get writes(){return writes}}
}
test('configured policy is a 2-hour cooldown, rolling 24-hour two-play cap and 24-hour skip pause',()=>{
  assert.equal(INTRO_COOLDOWN_MS,2*HOUR)
  assert.equal(INTRO_WINDOW_MS,24*HOUR)
  assert.equal(INTRO_MAX_PLAYS,2)
  assert.equal(INTRO_SKIP_PAUSE_MS,24*HOUR)
})
test('the second automatic start is allowed exactly at the cooldown boundary',()=>{
  const storage=memory()
  assert.equal(claimIntroPlayback(storage,NOW),true)
  assert.equal(claimIntroPlayback(storage,NOW+2*HOUR-1),false)
  assert.equal(claimIntroPlayback(storage,NOW+2*HOUR),true)
  assert.equal(claimIntroPlayback(storage,NOW+4*HOUR),false)
  assert.equal(storage.writes,2)
})
test('the rolling limit expires old starts individually, not at midnight',()=>{
  const storage=memory(record([NOW-HOUR,NOW+HOUR]))
  assert.equal(claimIntroPlayback(storage,NOW+3*HOUR),false)
  assert.equal(claimIntroPlayback(storage,NOW+23*HOUR-1),false)
  assert.equal(claimIntroPlayback(storage,NOW+23*HOUR),true)
  assert.deepEqual(readIntroFrequency(storage,NOW+23*HOUR).plays,[NOW+HOUR,NOW+23*HOUR])
})
test('explicit skip pauses from the skip time without adding a playback',()=>{
  const storage=memory(record([NOW-HOUR]))
  assert.equal(snoozeIntroPlayback(storage,NOW),true)
  assert.deepEqual(readIntroFrequency(storage,NOW),{plays:[NOW-HOUR],snoozedUntil:NOW+24*HOUR})
  assert.equal(claimIntroPlayback(storage,NOW+24*HOUR-1),false)
  assert.equal(claimIntroPlayback(storage,NOW+24*HOUR),true)
})
test('skipping during preparation can pause with zero completed or started plays',()=>{
  const storage=memory()
  snoozeIntroPlayback(storage,NOW)
  assert.deepEqual(readIntroFrequency(storage,NOW),{plays:[],snoozedUntil:NOW+24*HOUR})
})
test('reading blocked visits never extends cooldown or snooze timestamps',()=>{
  const storage=memory(record([NOW],NOW+24*HOUR))
  for(let offset=0;offset<24*HOUR;offset+=HOUR) assert.equal(canAutoPlayIntro(readIntroFrequency(storage,NOW+offset),NOW+offset),false)
  assert.equal(storage.writes,0)
})
test('malformed data is bounded and stale timestamps are pruned',()=>{
  for(const raw of [null,'bad','null','[]','false','42','"text"','{}']) assert.deepEqual(parseIntroFrequency(raw,NOW),{plays:[],snoozedUntil:0})
  assert.deepEqual(parseIntroFrequency(record([NOW-1,NOW-3,NOW-2,NOW-24*HOUR,'123',null,-1]),NOW),{plays:[NOW-2,NOW-1],snoozedUntil:0})
  assert.equal(parseIntroFrequency('{"snoozedUntil":"9999999999999"}',NOW).snoozedUntil,0)
})
test('clock rollback does not manufacture an extra eligible visit or shorten an existing pause',()=>{
  const storage=memory(record([NOW+HOUR],NOW+24*HOUR))
  assert.equal(canAutoPlayIntro(readIntroFrequency(storage,NOW),NOW),false)
  snoozeIntroPlayback(storage,NOW-HOUR)
  assert.equal(readIntroFrequency(storage,NOW).snoozedUntil,NOW+24*HOUR)
})
test('storage failures fail open to the page rather than allowing unrecorded autoplay',()=>{
  const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}}
  const full={getItem(){return null},setItem(){throw Error('quota')}}
  for(const storage of [null,denied,full]) {
    assert.equal(claimIntroPlayback(storage,NOW),false)
    assert.equal(snoozeIntroPlayback(storage,NOW),false)
  }
  assert.equal(canAutoPlayIntro(readIntroFrequency(denied,NOW),NOW),false)
})

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8')
const boot=html.match(/<script>([\s\S]*?)<\/script>/)[1].replaceAll('%BASE_URL%','/')
function bootCover(raw,{denied=false,home=true,hidden=false,reduced=false,navigation='navigate'}={}) {
  const attributes=new Map()
  const root={classList:{toggle(){}},style:{},setAttribute:(name,value)=>attributes.set(name,value),removeAttribute:name=>attributes.delete(name)}
  const matchMedia=query=>({matches:query.includes('reduced-motion')?reduced:false})
  vm.runInNewContext(boot,{
    document:{documentElement:root,hidden},Date:{now:()=>NOW},location:{pathname:home?'/':'/articles/1'},matchMedia,
    performance:{getEntriesByType:()=>[{type:navigation}]},
    window:{matchMedia,setTimeout(){},localStorage:{getItem(key){if(denied)throw Error('denied');return key===INTRO_FREQUENCY_KEY?raw:null}}},
  })
  return attributes.has('data-intro-boot')
}
test('the synchronous HTML cover and mounted policy agree across all cooldown/limit boundaries',()=>{
  const cases=[null,'bad','null','42','[]',record(),record([NOW]),record([NOW-2*HOUR+1]),record([NOW-2*HOUR]),record([NOW-5*HOUR,NOW-3*HOUR]),record([NOW-24*HOUR,NOW-3*HOUR]),record([],NOW+1),record([],NOW),record([NOW+HOUR]),record(['bad',null,-1,NOW-3*HOUR])]
  for(const raw of cases) assert.equal(bootCover(raw),canAutoPlayIntro(parseIntroFrequency(raw,NOW),NOW),raw)
})
test('boot does not flash a cover on deep links, history navigation, reduced motion or denied storage',()=>{
  for(const options of [{home:false},{hidden:true},{reduced:true},{navigation:'back_forward'},{denied:true}]) assert.equal(bootCover(null,options),false)
  assert.equal(bootCover(null,{navigation:'reload'}),true)
})
test('only explicit skip controls use snooze, while ordinary route and header exits just settle',()=>{
  const overlay=readFileSync(new URL('../src/features/home-intro/ui/HomeIntroOverlay.vue',import.meta.url),'utf8')
  const app=readFileSync(new URL('../src/app/App.vue',import.meta.url),'utf8')
  assert.match(overlay,/@click="intro.skip"/)
  assert.match(app,/route.name !== ROUTE_NAME.HOME\) homeIntro.finish\(\)/)
  assert.match(app,/@click.capture="homeIntro.active.value && homeIntro.finish\(\)"/)
  assert.doesNotMatch(html,/sessionStorage.getItem\('now.homeIntro.v1'\)/)
})
