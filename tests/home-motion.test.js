import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceRelease, easeRelease, nameLines } from '../src/webgl/homeMotion.js'

test('formation loosens with actual hero progress and can reverse before release', () => {
  assert.deepEqual(advanceRelease(false, 0), { released: false, amount: 0 })
  const midway = advanceRelease(false, .4)
  assert.ok(midway.amount > 0 && midway.amount < 1)
  assert.equal(advanceRelease(midway.released, 0).amount, 0)
})
test('release is latched for this visit, including deep restoration and resize', () => {
  const deep = advanceRelease(false, 4)
  assert.deepEqual(deep, { released: true, amount: 1 })
  assert.deepEqual(advanceRelease(deep.released, 0), deep)
  assert.deepEqual(advanceRelease(true, .1), deep)
})
test('large scroll jumps and background-tab time cannot jump the release blend', () => {
  assert.equal(easeRelease(0, 1, 0), 0)
  assert.ok(easeRelease(0, 1, 10) < .06)
  let value = 0
  for (let i = 0; i < 240; i++) value = easeRelease(value, 1, 1 / 60)
  assert.ok(value > .99)
})
test('responsive lines preserve the exact name and case', () => {
  for (const width of [320, 390, 600, 768, 1440]) {
    assert.equal(nameLines(width).join(''), 'YuugouOhno')
  }
  assert.deepEqual(nameLines(390), ['Yuugou', 'Ohno'])
})

test('overscroll is clamped and release is continuous at the configurable boundaries', async () => {
  const { RELEASE_START, RELEASE_END } = await import('../src/webgl/homeMotion.js')
  assert.equal(advanceRelease(false, -1).amount, 0)
  assert.equal(advanceRelease(false, RELEASE_START).amount, 0)
  assert.equal(advanceRelease(false, RELEASE_END - 1e-8).released, false)
  assert.equal(advanceRelease(false, RELEASE_END).released, true)
  let previous = 0
  for (let i = 0; i <= 100; i++) {
    const { amount } = advanceRelease(false, i / 100)
    assert.ok(amount >= previous && amount <= 1)
    previous = amount
  }
})
