import assert from 'node:assert/strict'
import { test } from 'node:test'
import { liquidSurfaceFrame } from '../../src/shared/utils/liquidPanelGeometry.ts'

for (const [w,h,anchor] of [[120,168,60],[176,120,153],[512,544,489],[366,620,300],[120,168,0],[1,1,0]]) {
  for (const variant of ['drop','search']) {
    test(`${variant}: ${w}x${h}, finite continuous geometry and content gating`, () => {
      let previousWidth=0,previousBottom=-Infinity
      for(let i=0;i<=100;i++) {
        const frame=liquidSurfaceFrame(w,h,anchor,i/100,12,variant,28)
        assert.ok(!/NaN|Infinity|undefined/.test(frame.path))
        assert.ok(frame.body.left>=0 && frame.body.left+frame.body.width<=w+1e-6)
        assert.ok(frame.body.top>=-12 && frame.body.top+frame.body.height<=h+1e-6)
        assert.ok(frame.body.width>=previousWidth && frame.body.top+frame.body.height>=previousBottom-1e-6)
        assert.ok(frame.contentOpacity===0 || frame.fullSurface, 'content visible before surface is complete')
        previousWidth=frame.body.width;previousBottom=frame.body.top+frame.body.height
      }
      const final=liquidSurfaceFrame(w,h,anchor,1,12,variant,28)
      assert.equal(final.body.left,0);assert.equal(final.body.top,0)
      assert.equal(final.body.width,w);assert.equal(final.body.height,h)
      assert.equal(final.contentOpacity,1)
    })
  }
}
test('closing hides content before any shape contraction',()=>{
  for(let i=100;i>=0;i--){const f=liquidSurfaceFrame(120,168,60,i/100);if(f.body.width<120||f.body.height<168)assert.equal(f.contentOpacity,0)}
})
test('origin follows trigger; complete surface matches its actual CSS radius',()=>{
  const first=liquidSurfaceFrame(512,544,489,0)
  assert.equal(first.body.left+first.body.width/2,489)
  assert.equal(liquidSurfaceFrame(512,544,489,1,12,'drop',28).body.radius,28)
})
test('search begins at full input width, not a separate droplet',()=>{
  const f=liquidSurfaceFrame(300,100,150,0,0,'search')
  assert.equal(f.body.width,300);assert.equal(f.body.height,0.01);assert.equal(f.body.top,0)
})

for(const [width,anchor] of [[176,153],[512,489],[366,300]]) {
  test('single attached surface and fixed source '+width,()=>{
    for(let i=0;i<=100;i++){
      const f=liquidSurfaceFrame(width,544,anchor,i/100,12)
      assert.equal((f.path.match(/M /g)||[]).length,1,'detached bead or neck subpath')
      assert.equal(f.origin.x,anchor)
      assert.equal(f.origin.y,-12)
      if(i<=50)assert.equal(f.body.top,-12,'source drifts before spreading')
      if(i<=35)assert.ok(f.body.width>f.body.height,'early surface should spread, not hang as a ball')
    }
  })
}
test('signed source offset preserves final panel bounds',()=>{
  for(const gap of [-8,0,12])for(let i=0;i<=100;i++){
    const f=liquidSurfaceFrame(176,120,153,i/100,gap)
    assert.equal(f.origin.y,-gap || 0)
    assert.ok(f.body.top+f.body.height<=120+1e-6)
    assert.ok(!/NaN|Infinity/.test(f.path))
  }
})
