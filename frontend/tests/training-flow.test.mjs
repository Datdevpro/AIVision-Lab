import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceFlowFrame, isFlowRunning, trainingStatusLabels } from '../src/features/neural-visualizer/training-flow.ts'

function collectFrames(length, layerCount, backward, backwardStart = 0) {
  const frames = [{ edge: 0, reverse: false }]
  for (let i = 1; i < length; i++) {
    frames.push(advanceFlowFrame(frames.at(-1), layerCount, backward, backwardStart))
  }
  return frames
}

test('preparation and all terminal states stop the automatic animation', () => {
  for (const status of [undefined, 'idle', 'preparing', 'completed', 'cancelled', 'failed']) {
    assert.equal(isFlowRunning(status), false, status)
  }
  assert.equal(isFlowRunning('training'), true)
  assert.equal(isFlowRunning('validating'), true)
})

test('training sweeps forward then backward through trainable layers', () => {
  const frames = collectFrames(7, 4, true)
  assert.deepEqual(frames, [
    { edge: 0, reverse: false }, { edge: 1, reverse: false }, { edge: 2, reverse: false },
    { edge: 2, reverse: true }, { edge: 1, reverse: true }, { edge: 0, reverse: true },
    { edge: 0, reverse: false },
  ])
})

test('frozen MobileNet extractor never shows a backward weight update', () => {
  for (const layerCount of [3, 4, 6]) {
    const frames = collectFrames(40, layerCount, true, 1)
    assert.ok(frames.some(frame => frame.reverse))
    assert.ok(frames.every(frame => !frame.reverse || frame.edge >= 1))
    assert.ok(frames.every(frame => frame.edge >= 0 && frame.edge < layerCount - 1))
  }
})

test('validation and manual preview only propagate forward', () => {
  for (const [step, frame] of collectFrames(20, 4, false, 1).entries()) {
    assert.equal(frame.reverse, false)
    assert.equal(frame.edge, step % 3)
  }
})

test('changing training/validation never skips the final hidden-to-output edge', () => {
  for (const layerCount of [3, 4, 6]) {
    let frame = { edge: 0, reverse: false }
    // Alternate modes every tick, faster than a full sweep can complete.
    for (let step = 0; step < 30; step++) {
      const next = advanceFlowFrame(frame, layerCount, step % 2 === 0, 1)
      if (!frame.reverse && frame.edge < layerCount - 2) {
        assert.deepEqual(next, { edge: frame.edge + 1, reverse: false })
      }
      frame = next
    }
    // A validation transition on the last forward step must reach the output.
    assert.deepEqual(advanceFlowFrame({ edge: layerCount - 3, reverse: false }, layerCount, false, 1), {
      edge: layerCount - 2, reverse: false,
    })
  }
})

test('the output connection stays active when forward flow reverses', () => {
  for (const layerCount of [3, 4, 6]) {
    const frame = { edge: layerCount - 2, reverse: false }
    assert.deepEqual(advanceFlowFrame(frame, layerCount, true, 1), { ...frame, reverse: true })
  }
})

test('validation exits a backward sweep without continuing weight updates', () => {
  assert.deepEqual(advanceFlowFrame({ edge: 2, reverse: true }, 4, false, 1), { edge: 0, reverse: false })
})

test('every backend status has a user-facing label', () => {
  assert.deepEqual(Object.keys(trainingStatusLabels).sort(), ['cancelled', 'completed', 'failed', 'idle', 'preparing', 'training', 'validating'])
})
