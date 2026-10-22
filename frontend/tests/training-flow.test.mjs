import assert from 'node:assert/strict'
import test from 'node:test'
import { isFlowRunning, trainingStatusLabels } from '../src/features/neural-visualizer/training-flow.ts'

test('preparation and all terminal states stop the automatic animation', () => {
  for (const status of [undefined, 'idle', 'preparing', 'completed', 'cancelled', 'failed']) {
    assert.equal(isFlowRunning(status), false, status)
  }
  assert.equal(isFlowRunning('training'), true)
  assert.equal(isFlowRunning('validating'), true)
})

test('every backend status has a user-facing label', () => {
  assert.deepEqual(Object.keys(trainingStatusLabels).sort(), ['cancelled', 'completed', 'failed', 'idle', 'preparing', 'training', 'validating'])
})
