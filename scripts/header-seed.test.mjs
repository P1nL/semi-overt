import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { getHeaderSeedFrame } from '../src/widgets/app-header/model/headerSeed.ts'
import { HOME_INTRO, INTRO_MOTION, categoryEntryPose, categoryVisualBounds, seedSeparationProgress } from '../src/features/home-intro/model/choreography.ts'

const desktop=[{left:265.6,top:22,width:53.6,height:53.6},{left:849,top:22,width:231,height:53.6}]
const mobile=[{left:82,top:22,width:50,height:50},{left:185,top:22,width:181,height:50}]
test('separation draws a narrowing connected neck, then releases a larger solid drop',()=>{
  for(const boxes of [desktop,mobile]) {
    const early=getHeaderSeedFrame(...boxes,.35,0,0)
    const late=getHeaderSeedFrame(...boxes,.85,0,0)
    const detached=getHeaderSeedFrame(...boxes,1,0,0)
    assert.ok(early.neck.startsWith('M'))
    assert.ok(late.neck.startsWith('M'))
    assert.ok(late.neckHalf<early.neckHalf)
    assert.equal(detached.neck,'')
    assert.ok(detached.width>=20)
    assert.ok(detached.x>boxes[0].left+boxes[0].width)
  }
})
test('the detached drop travels straight, then grows rightward',()=>{
  for(const boxes of [desktop,mobile]) {
    const start=getHeaderSeedFrame(...boxes,1,0,0)
    const mid=getHeaderSeedFrame(...boxes,1,.5,0)
    const end=getHeaderSeedFrame(...boxes,1,1,0)
    assert.ok(start.x<mid.x && mid.x<end.x)
    assert.equal(mid.y,start.y)
    assert.ok(Math.abs(end.x-boxes[1].left)<1e-9)
    assert.equal(mid.neck,'')
    const done=getHeaderSeedFrame(...boxes,1,1,1)
    assert.equal(done.x,boxes[1].left)
    assert.ok(Math.abs(done.y-boxes[1].top)<1e-9)
    assert.equal(done.width,boxes[1].width)
    assert.equal(done.height,boxes[1].height)
    assert.equal(done.emissionOpacity,0)
  }
})
test('every flight sample lies on the endpoint line, including vertically offset targets',()=>{
  for(const tools of [desktop[1],{...desktop[1],top:45}]) {
    const start=getHeaderSeedFrame(desktop[0],tools,1,0,0)
    const end=getHeaderSeedFrame(desktop[0],tools,1,1,0)
    for(let i=0;i<=100;i++) {
      const point=getHeaderSeedFrame(desktop[0],tools,1,i/100,0)
      const cross=(point.x-start.x)*(end.y-start.y)-(point.y-start.y)*(end.x-start.x)
      assert.ok(Math.abs(cross)<1e-7)
    }
  }
})
test('the seed itself emits green light, without a white halo or hard stroke',()=>{
  const source=readFileSync(new URL('../src/widgets/app-header/HeaderIntroEffects.vue',import.meta.url),'utf8')
  const core=source.match(/<rect class="header-intro-seed"[^>]+>/)[0]
  assert.doesNotMatch(core,/stroke/)
  assert.doesNotMatch(source,/header-intro-seed-glow|color-intro-seed-glow/)
  assert.match(source,/class="header-intro-seed-emission"/)
  assert.match(source,/<feGaussianBlur in="SourceGraphic" stdDeviation="3"/)
  assert.match(source,/<feMergeNode in="SourceGraphic"/)
  assert.match(source,/stop-color="var\(--color-intro-seed-core\)"/)
  const theme=readFileSync(new URL('../src/app/styles/theme.css',import.meta.url),'utf8')
  assert.doesNotMatch(theme,/--color-intro-seed-glow:/)
  for(const key of ['light','core','edge']) {
    const hex=theme.match(new RegExp(`--color-intro-seed-${key}: #([0-9a-f]{6});`))[1]
    const [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16))
    assert.ok(g>r && g>b)
  }
  assert.equal(getHeaderSeedFrame(...desktop,1,.5,0).emissionOpacity,1)
})
test('seed emission is a muted deep green with the same edge color as the navigation',()=>{
  const theme=readFileSync(new URL('../src/app/styles/theme.css',import.meta.url),'utf8')
  const color=key=>theme.match(new RegExp(`--color-${key}: (#[0-9a-f]{6});`))[1]
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))
  const palette=['light','core','edge'].map(key=>rgb(color(`intro-seed-${key}`)))
  assert.equal(color('intro-seed-edge'),color('brand-logo-bg'))
  const brightness=([r,g,b])=>.2126*r+.7152*g+.0722*b
  assert.ok(brightness(palette[0])>brightness(palette[1]))
  assert.ok(brightness(palette[1])>brightness(palette[2]))
  assert.ok(palette.every(([r,g,b])=>g>r && g>b && g<=160))
})
test('release starts at maximum speed and strictly decelerates on the straight path',()=>{
  for(const boxes of [desktop,mobile]) {
    let previous=getHeaderSeedFrame(...boxes,1,0,0).x
    let previousStep=Infinity
    const steps=[]
    for(let i=1;i<=20;i++) {
      const x=getHeaderSeedFrame(...boxes,1,i/20,0).x
      const step=x-previous
      assert.ok(step>0 && step<previousStep)
      steps.push(step); previous=x; previousStep=step
    }
    assert.ok(steps[0]>steps[19]*100)
  }
})
test('the liquid neck attaches to the same rightward-deformed donor as the button',()=>{
  const origin=-65.6
  for(const p of [.55,.7,.85,.95]) {
    const time=HOME_INTRO.seed+(HOME_INTRO.seedDetached-HOME_INTRO.seed)*p
    const pose=categoryEntryPose(time,origin)
    const donor=categoryVisualBounds(desktop[0],pose)
    const frame=getHeaderSeedFrame(...desktop,p,0,0,donor)
    assert.ok(pose.rim[0]>pose.rim[16])
    assert.ok(donor.left+donor.width>desktop[0].left+desktop[0].width)
    assert.ok(frame.neck.startsWith(`M${donor.left+donor.width-10} `))
  }
})
test('the seed starts with no visible geometry and buds during the first rightward stretch',()=>{
  for(const boxes of [desktop,mobile]) {
    const before=getHeaderSeedFrame(...boxes,0,0,0)
    assert.equal(before.width,0)
    assert.equal(before.height,0)
    assert.equal(before.neck,'')
    assert.equal(before.emissionOpacity,0)
    for(const elapsed of [30,60,90]) {
      const time=HOME_INTRO.seed+elapsed
      const donor=categoryVisualBounds(boxes[0],categoryEntryPose(time))
      const frame=getHeaderSeedFrame(...boxes,seedSeparationProgress(time),0,0,donor)
      assert.ok(frame.width>8)
      assert.ok(frame.emissionOpacity>.4)
      assert.ok(frame.x+frame.width>donor.left+donor.width)
      assert.ok(frame.neck.startsWith(`M${donor.left+donor.width-10} `))
    }
  }
})
test('only neck thinning is shortened: bud growth is unchanged and release immediately hands off to flight',()=>{
  for(const elapsed of [0,30,60,90,150,INTRO_MOTION.seedBirth]) {
    const split=seedSeparationProgress(HOME_INTRO.seed+elapsed)
    assert.ok(Math.abs(split-elapsed/1090)<1e-12)
    const frame=getHeaderSeedFrame(...desktop,split,0,0)
    const previous=getHeaderSeedFrame(...desktop,elapsed/1090,0,0)
    assert.ok(Math.abs(frame.width-previous.width)<1e-9)
    assert.ok(Math.abs(frame.emissionOpacity-previous.emissionOpacity)<1e-9)
  }
  const midway=getHeaderSeedFrame(...desktop,seedSeparationProgress(HOME_INTRO.seed+500),0,0)
  const previous=getHeaderSeedFrame(...desktop,500/1090,0,0)
  assert.ok(midway.neckHalf<previous.neckHalf)
  assert.equal(seedSeparationProgress(HOME_INTRO.seedDetached),1)
  assert.equal(getHeaderSeedFrame(...desktop,seedSeparationProgress(HOME_INTRO.seedDetached),0,0).neck,'')
  assert.equal(HOME_INTRO.seedDetached-HOME_INTRO.seed,850)
  assert.equal(HOME_INTRO.capsule-HOME_INTRO.seedDetached,1180)
  const source=readFileSync(new URL('../src/widgets/app-header/HeaderIntroEffects.vue',import.meta.url),'utf8')
  assert.match(source,/getHeaderSeedFrame\(c, n,\s*seedSeparationProgress\(t.value\)/)
})
test('the luminous circle fully clears the stretched button at release on desktop and mobile',()=>{
  for(const boxes of [desktop,mobile]) {
    const donor=categoryVisualBounds(boxes[0],categoryEntryPose(HOME_INTRO.seedDetached))
    const frame=getHeaderSeedFrame(...boxes,1,0,0,donor)
    assert.ok(frame.x>donor.left+donor.width)
    assert.equal(frame.neck,'')
  }
})
test('sampled seed geometry stays finite through all three stages',()=>{
  for(const boxes of [desktop,mobile]) for(let i=0;i<=100;i++) {
    for(const values of [[i/100,0,0],[1,i/100,0],[1,1,i/100]]) {
      const frame=getHeaderSeedFrame(...boxes,...values)
      for(const key of ['x','y','width','height','neckHalf','neckOpacity']) assert.ok(Number.isFinite(frame[key]))
      assert.doesNotMatch(frame.neck,/NaN|Infinity/)
      assert.ok(frame.width>=0 && frame.height>=0)
      if(values[0]>0) assert.ok(frame.width>0 && frame.height>0)
    }
  }
})
