import assert from 'node:assert/strict'
import test from 'node:test'
import { getFlowFrame, isFlowRunning, trainingStatusLabels } from '../src/features/neural-visualizer/training-flow.ts'

test('preparation and all terminal states stop the automatic animation', () => {
  for (const status of [undefined, 'idle', 'preparing', 'completed', 'cancelled', 'failed']) {
    assert.equal(isFlowRunning(status), false, status)
  }
  assert.equal(isFlowRunning('training'), true)
  assert.equal(isFlowRunning('validating'), true)
})

test('training sweeps forward then backward through trainable layers', () => {
  const frames = Array.from({ length: 7 }, (_, i) => getFlowFrame(i, 4, true))
  assert.deepEqual(frames, [
    { edge: 0, reverse: false }, { edge: 1, reverse: false }, { edge: 2, reverse: false },
    { edge: 2, reverse: true }, { edge: 1, reverse: true }, { edge: 0, reverse: true },
    { edge: 0, reverse: false },
  ])
})

test('frozen MobileNet extractor never shows a backward weight update', () => {
  for (const layerCount of [3, 4, 6]) {
    const frames = Array.from({ length: 40 }, (_, i) => getFlowFrame(i, layerCount, true, 1))
    assert.ok(frames.some(frame => frame.reverse))
    assert.ok(frames.every(frame => !frame.reverse || frame.edge >= 1))
    assert.ok(frames.every(frame => frame.edge >= 0 && frame.edge < layerCount - 1))
  }
})

test('validation and manual preview only propagate forward', () => {
  for (let step = 0; step < 20; step++) {
    const frame = getFlowFrame(step, 4, false, 1)
    assert.equal(frame.reverse, false)
    assert.equal(frame.edge, step % 3)
  }
})

test('every backend status has a user-facing label', () => {
  assert.deepEqual(Object.keys(trainingStatusLabels).sort(), ['cancelled', 'completed', 'failed', 'idle', 'preparing', 'training', 'validating'])
})
