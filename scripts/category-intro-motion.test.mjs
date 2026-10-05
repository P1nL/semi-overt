import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as magnetic from '../src/shared/utils/magneticSpring.ts'
import { HOME_INTRO as T, INTRO_MOTION as M, categoryEntryPose, categoryVisualBounds } from '../src/features/home-intro/model/choreography.ts'

const bridgeExports = {}
vm.runInNewContext(ts.transpileModule(
  readFileSync(new URL('../src/widgets/app-header/model/liquidBridge.ts',import.meta.url),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS}},
).outputText, {exports:bridgeExports,require:()=>magnetic})
const {createLiquidBridgePath} = bridgeExports

test('category is ejected from the home anchor then visibly overshoots and recoils',()=>{
  const origin=-65.6
  assert.equal(categoryEntryPose(T.category,origin).x,origin)
  const mid=categoryEntryPose(T.category+90,origin)
  const peak=categoryEntryPose(T.category+170,origin)
  const recoil=categoryEntryPose(T.category+300,origin)
  assert.ok(mid.x>origin+50)
  assert.ok(peak.x>25)
  assert.ok(recoil.x<peak.x-12)
  assert.ok(mid.scaleX>mid.scaleY)
  assert.equal(M.categoryPop,180)
})
test('the first stretch is visibly wide and compressed without distorting the folder icon',()=>{
  for(const size of [50,53.6]) {
    const box={left:100,top:22,width:size,height:size}
    const pose=categoryEntryPose(T.category+150)
    const visual=categoryVisualBounds(box,pose)
    assert.ok(visual.width>box.width*1.6)
    assert.ok(visual.height<box.height*.7)
    assert.ok(pose.iconScale<=1.08)
    assert.ok(pose.rim[0]>.34)
  }
  assert.equal(categoryEntryPose(T.category+M.categoryPop).x,28)
})
test('the category stretches right throughout emission and is still deformed at release',()=>{
  for(let elapsed=80;elapsed<=T.seedDetached-T.seed;elapsed+=40) {
    const pose=categoryEntryPose(T.seed+elapsed)
    assert.ok(pose.rim[0]>pose.rim[16])
  }
  const atRelease=categoryEntryPose(T.seedDetached)
  assert.ok(atRelease.x>4)
  assert.ok(atRelease.rim[0]>.05)
  assert.ok(categoryEntryPose(T.seedDetached+140).x<0)
})
test('emission belongs to the first overshoot, with no second late inflation',()=>{
  assert.equal(T.seed-T.category,90)
  assert.ok(T.seed<T.category+M.categoryPop)
  let previous=categoryEntryPose(T.category+M.categoryPop)
  for(let time=T.category+M.categoryPop+5;time<=T.seedDetached;time+=5) {
    const pose=categoryEntryPose(time)
    assert.ok(pose.x<=previous.x+1e-9,`second displacement at ${time}`)
    assert.ok(pose.rim[0]<=previous.rim[0]+1e-9,`second inflation at ${time}`)
    previous=pose
  }
})
test('all intro poses preserve rim caps and return exactly to the resting geometry',()=>{
  for(let time=T.category;time<=T.seedDetached+650;time+=7) {
    const pose=categoryEntryPose(time)
    assert.ok(Number.isFinite(pose.x))
    assert.ok(pose.scaleX>0 && pose.scaleY>0 && pose.iconScale>0)
    assert.ok(pose.rim.every(v=>v>=-.30 && v<=.60))
  }
  const resting=categoryEntryPose(T.seedDetached+650)
  assert.equal(resting.x,0)
  assert.equal(resting.scaleX,1)
  assert.equal(resting.scaleY,1)
  assert.equal(resting.iconScale,1)
  assert.ok(resting.rim.every(v=>v===0))
  const box={left:265.6,top:22,width:53.6,height:53.6}
  const visual=categoryVisualBounds(box,resting)
  for(const key of Object.keys(box)) assert.ok(Math.abs(visual[key]-box[key])<1e-9)
})
test('only visual layers move; the real category button keeps its fixed hit target',()=>{
  const source=readFileSync(new URL('../src/widgets/category-menu/CategoryMenu.vue',import.meta.url),'utf8')
  const root=source.match(/<div ref="rootRef"[^>]+>/)[0]
  assert.doesNotMatch(root,/transform|translate|scale/)
  assert.match(source,/class="category-menu-trigger__visual" :style="visualStyle"/)
  assert.match(source,/:transform="magneticBackgroundTransform"/)
})
test('closed-menu goo nodes cannot leave a stationary dot behind the thrown button',()=>{
  const source=readFileSync(new URL('../src/widgets/category-menu/CategoryMenu.vue',import.meta.url),'utf8')
  assert.match(source,/<template v-if="!introActive">\s*<circle[^>]*class="category-goo-node"[^>]*\/>\s*<\/template>/)
  assert.match(source,/opacity: introTime >= HOME_INTRO.category \? 1 : 0/)
})
test('the entire category stack stays under the home disc, with the liquid bridge below both',()=>{
  const source=readFileSync(new URL('../src/widgets/app-header/AppHeader.vue',import.meta.url),'utf8')
  const home=Number(source.match(/\.header-leading > :deep\(\.brand-home-link\) \{ z-index: (\d+); \}/)[1])
  const category=Number(source.match(/\.header-leading > :deep\(\.category-orbit\) \{ z-index: (\d+); \}/)[1])
  const bridge=Number(source.match(/\.header-liquid-bridge \{[^}]*z-index: (\d+);/)[1])
  assert.ok(home>category && category>bridge)
})
test('the home connection is opaque from launch, and follows the scaled liquid contour',()=>{
  const source=readFileSync(new URL('../src/widgets/app-header/model/useHeaderIntro.ts',import.meta.url),'utf8')
  assert.match(source,/'--intro-bridge-opacity': t >= HOME_INTRO.category \? 1 : 0/)
  assert.doesNotMatch(source,/bridgeDelay|bridgeFade/)
  for(const [width,height] of [[119.2,53.6],[108,50]]) {
    const radius=height/2
    for(let elapsed=10;elapsed<=450;elapsed+=10) {
      const pose=categoryEntryPose(T.category+elapsed,height-width)
      const path=createLiquidBridgePath(width,height,pose)
      const values=path.match(/-?\d+(?:\.\d+)?/g).map(Number)
      const shoulder=magnetic.deformLiquidPoint({x:-radius*.7,y:-radius*Math.sqrt(1-.7**2)},pose)
      assert.ok(Math.abs(values[6]-(width-radius+pose.x+shoulder.x*pose.scaleX))<.001)
      assert.ok(Math.abs(values[7]-(radius+shoulder.y*pose.scaleY))<.001)
      assert.ok(values.every(Number.isFinite))
    }
    const rest={x:0,y:0}
    assert.equal(createLiquidBridgePath(width,height,rest),createLiquidBridgePath(width,height,{...rest,scaleX:1,scaleY:1}))
  }
})
