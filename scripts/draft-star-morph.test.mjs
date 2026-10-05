import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDraftPanelPlacement, getDraftStarCurves, getDraftStarPath } from '../src/features/draft-box/model/draftStarMorph.ts'
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const at = (q, t) => ({ x: (1-t)**2*q.from.x + 2*(1-t)*t*q.control.x + t*t*q.to.x, y: (1-t)**2*q.from.y + 2*(1-t)*t*q.control.y + t*t*q.to.y })
test('initial shape exactly preserves all four supplied quadratic edges after subdivision', () => {
  const curves = getDraftStarCurves(512, 400, 0)
  const tips = [{x:0,y:-14},{x:14,y:0},{x:0,y:14},{x:-14,y:0}]
  const controls = [{x:1.4,y:-1.4},{x:1.4,y:1.4},{x:-1.4,y:1.4},{x:-1.4,y:-1.4}]
  const cuts = [0,0.4,0.6,1]
  curves.forEach((curve, index) => {
    const quadrant = Math.floor(index/3), part = index%3
    const original = {from:tips[quadrant],control:controls[quadrant],to:tips[(quadrant+1)%4]}
    for(let t=0;t<=1;t+=0.1) {
      const expected=at(original,cuts[part]+(cuts[part+1]-cuts[part])*t), actual=at(curve,t)
      close(actual.x,expected.x);close(actual.y,expected.y)
    }
  })
})
test('four cardinal points expand outward to a rounded rectangle, with no path discontinuities', () => {
  let previous = 0
  for(let step=0;step<=100;step++) {
    const p=step/100, curves=getDraftStarCurves(512,400,p,28)
    assert.equal(curves.length,12)
    curves.forEach((curve,i) => {close(curve.to.x,curves[(i+1)%12].from.x);close(curve.to.y,curves[(i+1)%12].from.y)})
    assert.ok(curves[3].from.x>=previous)
    previous=curves[3].from.x
    assert.equal(curves[0].from.x,0)
    assert.equal(curves[3].from.y,0)
    assert.ok(!getDraftStarPath(512,400,p,28).includes('NaN'))
  }
  const final=getDraftStarCurves(512,400,1,28)
  assert.deepEqual(final[0].from,{x:0,y:-200})
  assert.deepEqual(final[3].from,{x:256,y:0})
  assert.deepEqual(final[6].from,{x:0,y:200})
  assert.deepEqual(final[9].from,{x:-256,y:0})
  assert.deepEqual(final[1].control,{x:256,y:-200})
  assert.deepEqual(final[1].from,{x:228,y:-200})
  assert.deepEqual(final[1].to,{x:256,y:-172})
})
test('panel center stays below trigger on wide and constrained viewports', () => {
  for(const [viewport,anchor] of [[1920,1440],[1280,1150],[390,300]]) {
    const result=getDraftPanelPlacement(anchor,512,viewport)
    close(result.left+result.width/2,anchor)
    assert.ok(result.width<=512)
    assert.ok(result.left>=12 && result.left+result.width<=viewport-12)
  }
})


test('left placement uses available width instead of symmetric edge space', () => {
  for (const [viewport, anchor] of [[2360, 2290], [1280, 1210], [390, 328], [320, 258]]) {
    const result = getDraftPanelPlacement(anchor, 512, viewport, 'left')
    close(result.left + result.width, anchor - 12)
    close(result.width, Math.min(512, anchor - 24, viewport - 24))
    assert.ok(result.left >= 12)
    assert.ok(result.left + result.width <= viewport - 12)
  }
})

test('viewport-adjusted origins preserve the star and morph into exact panel bounds', () => {
  for (const origin of [0.08, 0.16, 0.5, 0.82]) {
    assert.deepEqual(getDraftStarCurves(512, 400, 0, 28, origin), getDraftStarCurves(512, 400, 0, 28))
    for (let step = 0; step <= 100; step++) {
      const curves = getDraftStarCurves(512, 400, step / 100, 28, origin)
      curves.forEach((curve, index) => {
        close(curve.to.x, curves[(index + 1) % 12].from.x)
        close(curve.to.y, curves[(index + 1) % 12].from.y)
      })
    }
    const final = getDraftStarCurves(512, 400, 1, 28, origin)
    close(final[0].from.y, -400 * origin)
    close(final[6].from.y, 400 * (1 - origin))
    close(final[3].from.y, 400 * (0.5 - origin))
    close(final[9].from.y, 400 * (0.5 - origin))
    close(final[3].from.x, 256)
    close(final[9].from.x, -256)
  }
})
