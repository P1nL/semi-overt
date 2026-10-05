import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTextPressureScheduler } from './helpers/pressureScheduler.mjs'

function driver() {
  const frames = new Map()
  let id = 0
  return {
    frames,
    requestFrame(callback) { frames.set(++id, callback); return id },
    cancelFrame(key) { frames.delete(key) },
    step(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)) },
  }
}
test('pressure batches are capped at 60Hz on 144Hz callbacks and share cached geometry', () => {
  const d = driver(), scheduler = createTextPressureScheduler(d)
  let reads = 0, updates = 0
  const element = { getBoundingClientRect: () => { reads++; return { width: 1000 } } }
  const tasks = Array.from({ length: 8 }, () => ({
    prepare() {}, measure(_, frame) { frame.rect(element) }, mutate() { updates++; return true },
  }))
  tasks.forEach(task => { scheduler.request(task); scheduler.request(task) })
  assert.equal(d.frames.size, 1)
  for (let i = 0; i <= 144; i++) d.step(i * 1000 / 144)
  assert.equal(reads, 61)
  assert.equal(updates, 61 * 8)
  tasks.forEach(task => scheduler.cancel(task))
  assert.equal(d.frames.size, 0)
})
test('all prepare/measure/mutate phases stay ordered across concurrent instances', () => {
  const d = driver(), scheduler = createTextPressureScheduler(d), log = []
  for (let i = 0; i < 3; i++) scheduler.request({
    prepare: () => log.push('prepare' + i),
    measure: () => log.push('read' + i),
    mutate: () => { log.push('write' + i); return false },
  })
  d.step(0)
  assert.deepEqual(log, ['prepare0','prepare1','prepare2','read0','read1','read2','write0','write1','write2'])
  assert.equal(d.frames.size, 0)
})
test('canceling one instance does not cancel the other; idle/restart clears stale geometry', () => {
  const d = driver(), scheduler = createTextPressureScheduler(d)
  let reads = 0, liveUpdates = 0, canceledUpdates = 0
  const element = { getBoundingClientRect: () => { reads++; return { width: reads * 100 } } }
  const live = { prepare() {}, measure(_, frame) { frame.rect(element) }, mutate() { liveUpdates++; return false } }
  const canceled = { prepare() {}, measure() {}, mutate() { canceledUpdates++; return false } }
  scheduler.request(live); scheduler.request(canceled); scheduler.cancel(canceled)
  d.step(0)
  assert.equal(liveUpdates, 1)
  assert.equal(canceledUpdates, 0)
  scheduler.request(live)
  d.step(100000)
  assert.equal(reads, 2)
  assert.equal(liveUpdates, 2)
  assert.equal(d.frames.size, 0)
})

test('one-shot pointer requests cannot bypass the 60Hz cap by repeatedly going idle', () => {
  const d = driver(), scheduler = createTextPressureScheduler(d)
  let updates = 0
  const task = { prepare() {}, measure() {}, mutate() { updates++; return false } }
  for (let i = 0; i <= 144; i++) {
    scheduler.request(task)
    d.step(i * 1000 / 144)
  }
  assert.equal(updates, 61)
  scheduler.cancel(task)
  assert.equal(d.frames.size, 0)
})
