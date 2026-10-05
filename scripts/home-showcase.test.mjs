import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { createShowcaseSlots, isShowcaseLayoutReversed } from '../src/widgets/home-showcase/model/showcaseSlots.ts'

const articles = count => Array.from({length:count},(_,i)=>({id:i+1,titleText:`真实文章 ${i+1}`,articlePath:`/articles/${i+1}`}))

test('underfilled desktop decks have blank decorative slots on the left and real articles on the right',()=>{
  for(const count of [1,3,7,10,11,15]) {
    const items=articles(count)
    const slots=createShowcaseSlots(items,11,true)
    const realCount=Math.min(count,11), blankCount=11-realCount
    assert.equal(slots.length,11)
    assert.ok(slots.slice(0,blankCount).every(slot=>slot.kind==='decoration'))
    const real=slots.slice(blankCount)
    assert.ok(real.every(slot=>slot.kind==='article'))
    assert.deepEqual(real.map(slot=>slot.article),items.slice(0,11))
    real.forEach((slot,index)=>{
      assert.equal(slot.article,items[index])
      assert.equal(slot.articleIndex,index)
    })
    assert.equal(new Set(slots.map(slot=>slot.key)).size,11)
    for(const slot of slots.slice(0,blankCount)) {
      assert.deepEqual(Object.keys(slot).sort(),['key','kind'])
    }
  }
})
test('empty and narrow-screen lists never become a list of fake or blank articles',()=>{
  assert.deepEqual(createShowcaseSlots([],11,true),[])
  const items=articles(3)
  assert.deepEqual(createShowcaseSlots(items,11,false).map(slot=>slot.article),items)
  assert.equal(createShowcaseSlots(items,2,false).length,2)
  for(const invalid of [0,-1,NaN,Infinity]) assert.deepEqual(createShowcaseSlots(items,invalid,true),[])
  assert.equal(items.length,3)
})
test('content follows either direction of the original slots without changing article order or coordinates',()=>{
  for(const count of [1,3,10,11]) for(const step of [-160,-16,32,80]) {
    const offsets=Array.from({length:11},(_,i)=>i*step)
    const original=[...offsets], items=articles(count)
    const slots=createShowcaseSlots(items,11,true,isShowcaseLayoutReversed(offsets))
    const real=slots.flatMap((slot,i)=>slot.kind==='article'?[offsets[i]]:[])
    const decor=slots.flatMap((slot,i)=>slot.kind==='decoration'?[offsets[i]]:[])
    if(decor.length) assert.ok(Math.max(...decor)<Math.min(...real))
    assert.deepEqual(slots.filter(slot=>slot.kind==='article').map(slot=>slot.article),items)
    assert.deepEqual(offsets,original)
  }
  assert.equal(isShowcaseLayoutReversed([]),false)
  assert.equal(isShowcaseLayoutReversed([0]),false)
  assert.equal(isShowcaseLayoutReversed([0,0]),false)
  assert.deepEqual(createShowcaseSlots(articles(11),11,true,true),createShowcaseSlots(articles(11),11,true,false))
})
test('decoration roots are non-link hidden surfaces; only real cards render a title',()=>{
  const card=readFileSync(new URL('../src/widgets/home-showcase/HomeShowcaseCard.vue',import.meta.url),'utf8')
  assert.match(card,/:is="article \? RouterLink : 'div'"/)
  assert.match(card,/:to="article\?\.articlePath"/)
  assert.match(card,/:aria-hidden="!article \? 'true' : undefined"/)
  assert.match(card,/<template v-if="article">[\s\S]*<h3 class="home-showcase-card__title">\s*\{\{ article.titleText \}\}/)
  assert.doesNotMatch(card,/<component[\s\S]*?tabindex=/)
  assert.match(card,/data-title-effect-occluder/)
  assert.doesNotMatch(card,/\.home-showcase-card__title \{[^}]*animation:/)
  assert.doesNotMatch(card,/IntroGlyph|ScrambleText|TextPressure/)
})
test('all card slots expose hover geometry while only real articles expose navigation',()=>{
  const rail=readFileSync(new URL('../src/widgets/home-showcase/HomeShowcaseRail.vue',import.meta.url),'utf8')
  assert.match(rail,/props.featured && props.fillDecorative && isDesktopRail.value/)
  assert.match(rail,/if \(hoveredIndex.value === null\)/)
  assert.doesNotMatch(rail,/hoveredIndex.value === null \|\| visibleSlots.value\[index\]\?\.kind !== 'article'/)
  assert.match(rail,/:data-showcase-item-index="index"/)
  assert.match(rail,/if \(!item\) return/)
  assert.match(rail,/data-card-entry :style="entrance.style\(index, visibleSlots.length\)"/)
  assert.match(rail,/\(\) => visibleSlots.value.length/)
  assert.match(rail,/--showcase-item-overlap: clamp\(-45rem, -55vw, -50rem\)/)
  assert.doesNotMatch(rail,/home-showcase-rail--filled|clamp\(1rem, 2vw, 2rem\)/)
  assert.match(rail,/slots.map\(slot => slot.offsetLeft\)/)
  assert.match(rail,/:key="`\$\{motionIdPrefix\}-slot-\$\{index\}-\$\{layoutVersion\}`"/)
  const card=readFileSync(new URL('../src/widgets/home-showcase/HomeShowcaseCard.vue',import.meta.url),'utf8')
  assert.match(card,/\.home-showcase-card:hover \{\s*box-shadow:/)
})

// Exercise the component's actual motion and pointer logic, not a copied formula.
const railSetup=parse(readFileSync(new URL('../src/widgets/home-showcase/HomeShowcaseRail.vue',import.meta.url),'utf8')).descriptor.scriptSetup.content
const railAst=ts.createSourceFile('HomeShowcaseRail.ts',railSetup,ts.ScriptTarget.Latest,true)
const railMotionSource=railAst.statements.filter(node=>{
  if(ts.isVariableStatement(node)) return node.declarationList.declarations.some(item=>item.name.getText(railAst)==='getMotionState')
  return ts.isFunctionDeclaration(node) && ['handleRailPointerMove','clearHoveredItem','onItemClick','shouldUseNativeNavigation'].includes(node.name?.text)
}).map(node=>node.getText(railAst)).join('\n')
const railMotionCode=ts.transpileModule(railMotionSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
function motionHarness(slots) {
  const hoveredIndex={value:null},desktop={value:true},active={value:false},pushes=[]
  class Target {
    constructor(index){this.index=index}
    closest(){return this.index===null?null:{dataset:{showcaseItemIndex:String(this.index)}}}
  }
  const exports={}
  vm.runInNewContext(railMotionCode+'\nObject.assign(exports,{getMotionState,handleRailPointerMove,clearHoveredItem,onItemClick})',{
    exports,hoveredIndex,visibleSlots:{value:slots},isDesktopRail:desktop,entrance:{active},Element:Target,
    clearNavigationSettleTimer(){},syncMotionState:async()=>{},navigationSettleTimer:null,HOVER_SETTLE_BEFORE_NAVIGATE_MS:280,
    window:{setTimeout(fn){fn();return 1}},router:{push:path=>pushes.push(path)},
  })
  return {...exports,hoveredIndex,desktop,active,pushes,
    move(index,pointerType='mouse'){exports.handleRailPointerMove({pointerType,target:new Target(index)})},
    pose(index){return JSON.parse(JSON.stringify(exports.getMotionState(index)))},
  }
}
test('decorative neighbours use exactly the same lift, side push, tilt and spring as real cards',()=>{
  for(const reversed of [false,true]) for(const count of [1,3,7,10]) {
    const slots=createShowcaseSlots(articles(count),11,true,reversed), h=motionHarness(slots)
    const reference=motionHarness(createShowcaseSlots(articles(11),11))
    slots.forEach((_,index)=>{
      h.move(index);reference.move(index)
      slots.forEach((_,neighbour)=>assert.deepEqual(h.pose(neighbour),reference.pose(neighbour),`count=${count}, reversed=${reversed}, hover=${index}, neighbour=${neighbour}`))
    })
  }
})
test('decorations follow both nearest neighbours then settle back when the hover clears',()=>{
  const h=motionHarness(createShowcaseSlots(articles(3),11,true))
  h.move(8)
  assert.equal(h.pose(8).y,-400)
  assert.deepEqual([h.pose(7).x,h.pose(7).y,h.pose(7).rotate],[-40,-100,-4])
  assert.deepEqual([h.pose(6).x,h.pose(6).y,h.pose(6).rotate],[-10,-40,-1])
  assert.equal(h.pose(5).y,0)
  h.clearHoveredItem()
  for(let index=0;index<11;index++) assert.deepEqual([h.pose(index).x,h.pose(index).y,h.pose(index).rotate],[0,0,0])
})
test('a decorative hover is fully animated after Splash without enabling navigation',async()=>{
  const h=motionHarness(createShowcaseSlots(articles(3),11,true))
  h.active.value=true
  h.move(7)
  assert.equal(h.hoveredIndex.value,null)
  h.active.value=false
  h.move(7)
  assert.equal(h.hoveredIndex.value,7)
  assert.equal(h.pose(7).y,-400)
  assert.equal(h.pose(6).y,-100)
  assert.equal(h.pose(8).y,-100)
  let prevented=false
  await h.onItemClick({preventDefault(){prevented=true}},undefined)
  assert.equal(prevented,false)
  assert.deepEqual(h.pushes,[])
  assert.equal(h.hoveredIndex.value,7)
  h.clearHoveredItem()
  assert.equal(h.pose(7).y,0)
})
test('touch, narrow layouts and invalid targets cannot start a decorative hover',()=>{
  const h=motionHarness(createShowcaseSlots(articles(3),11,true))
  h.move(7,'touch')
  assert.equal(h.hoveredIndex.value,null)
  h.desktop.value=false;h.move(7)
  assert.equal(h.hoveredIndex.value,null)
  h.desktop.value=true
  for(const index of [-1,11,1.5,NaN,Infinity,null]) {
    h.move(7)
    h.move(index)
    assert.equal(h.hoveredIndex.value,null,String(index))
  }
})
test('real article navigation still settles the deck before opening the article',async()=>{
  const items=articles(3),h=motionHarness(createShowcaseSlots(items,11,true))
  h.move(8)
  let prevented=false
  await h.onItemClick({button:0,preventDefault(){prevented=true}},items[0])
  assert.equal(prevented,true)
  assert.equal(h.hoveredIndex.value,null)
  assert.deepEqual(h.pushes,[items[0].articlePath])
})
test('development and production share real data and the intro freezes it until completion',()=>{
  const hero=readFileSync(new URL('../src/widgets/hero-section/HeroSection.vue',import.meta.url),'utf8')
  assert.doesNotMatch(hero,/createHomePreviewArticles|previewEnabled|previewArticles|import.meta.env.DEV/)
  assert.match(hero,/introItems.value = \[\.\.\.heroItems.value\]/)
  assert.match(hero,/homeIntro\?\.active.value && introItems.value !== null \? introItems.value : heroItems.value/)
  assert.match(hero,/fill-decorative/)
  assert.match(hero,/v-if="revealed && displayedItems.length"/)
})
test('unfinished article data leaves the bottom blank, without skeletons or status text',()=>{
  const hero=readFileSync(new URL('../src/widgets/hero-section/HeroSection.vue',import.meta.url),'utf8')
  const home=readFileSync(new URL('../src/pages/home/HomePage.vue',import.meta.url),'utf8')
  assert.match(hero,/v-if="revealed && displayedItems.length"/)
  assert.doesNotMatch(hero,/HomeContentPlaceholder|contentState|hero-section__status|home-content-status|正在加载文章|暂时没有文章|role="status"/)
  assert.doesNotMatch(home,/:content-state=/)
  assert.match(home,/const contentReady = computed\(\(\) => homeQuery.isSuccess.value\)/)
  assert.match(home,/:revealed="contentReady"/)
})
