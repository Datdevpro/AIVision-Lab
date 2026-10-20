import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeTrainingConfig } from '../src/features/training/training-config.ts'

test('adding blocks creates matching filter settings and preserves existing choices', () => {
  const original = { conv_blocks: 2, conv_filters: [16, 32] }
  const updated = mergeTrainingConfig(original, { conv_blocks: 4 })
  assert.deepEqual(updated.conv_filters, [16, 32, 64, 128])
  assert.deepEqual(original.conv_filters, [16, 32])
})

test('removing blocks removes unused filters', () => {
  const updated = mergeTrainingConfig({ conv_blocks: 4, conv_filters: [16, 32, 64, 128] }, { conv_blocks: 1 })
  assert.deepEqual(updated.conv_filters, [16])
})

test('editing a block preserves the other blocks', () => {
  const updated = mergeTrainingConfig({ conv_blocks: 3, conv_filters: [16, 32, 64] }, { conv_filters: [24, 32, 64] })
  assert.deepEqual(updated.conv_filters, [24, 32, 64])
})

test('existing mismatched drafts are repaired before training', () => {
  assert.deepEqual(mergeTrainingConfig({ conv_blocks: 3, conv_filters: [16, 32] }, {}).conv_filters, [16, 32, 64])
})

test('generated filter counts remain supported even when doubling reaches the limit', () => {
  for (const start of [8, 16, 24, 32, 48, 64, 96, 128]) {
    const config = mergeTrainingConfig({ conv_blocks: 1, conv_filters: [start] }, { conv_blocks: 4 })
    assert.equal(config.conv_filters.length, 4)
    assert.ok(config.conv_filters.every(value => [8, 16, 24, 32, 48, 64, 96, 128].includes(value)))
  }
})
