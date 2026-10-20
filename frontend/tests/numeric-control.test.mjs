import assert from 'node:assert/strict'
import test from 'node:test'
import { createNumericControl, formatParameterNumber } from '../src/features/training/numeric-control.ts'

const learningRate = { type: 'float', min: 0.00001, max: 0.1, step: null, scale: 'log' }

test('learning-rate slider uses clean logarithmic ticks across the full range', () => {
  const control = createNumericControl(learningRate, 0.001)
  const values = Array.from({ length: control.max + 1 }, (_, i) => control.fromSlider(i))
  assert.equal(values[0], 0.00001)
  assert.equal(values.at(-1), 0.1)
  assert.equal(control.fromSlider(control.value), 0.001)
  assert.ok(values.includes(0.0002))
  assert.ok(values.includes(0.002))
  assert.ok(!values.includes(0.000201))
  assert.ok(!values.includes(0.00201))
  assert.equal(new Set(values).size, values.length)
  assert.ok(values.every((value, i) => i === 0 || value > values[i - 1]))
})

test('moving the slider saves exactly the value shown and keeps its position', () => {
  const control = createNumericControl(learningRate, 0.001)
  for (let i = 0; i <= control.max; i++) {
    const value = control.fromSlider(i)
    assert.equal(Number(formatParameterNumber(value)), value)
    assert.equal(createNumericControl(learningRate, value).value, i)
  }
})

test('small float parameters retain their precision, including weight decay', () => {
  assert.equal(formatParameterNumber(0.00001), '0.00001')
  assert.equal(formatParameterNumber(0.0005), '0.0005')
  assert.equal(formatParameterNumber(0.0015), '0.0015')
  assert.equal(formatParameterNumber(0.3), '0.3')
  assert.equal(formatParameterNumber(0), '0')
})

test('linear sliders keep their step and remove floating-point artifacts', () => {
  const control = createNumericControl({ type: 'float', min: 0, max: 0.1, step: 0.0005 }, 0.0005)
  assert.equal(control.step, 0.0005)
  assert.equal(control.value, 0.0005)
  assert.equal(control.fromSlider(0.0005), 0.0005)
  assert.equal(control.fromSlider(0.1 + 0.2), 0.3)
})
