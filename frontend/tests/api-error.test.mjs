import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../src/services/api-error.ts'

test('validation banner includes every field and reason instead of only a generic message', () => {
  const details = [
    { field: 'config.conv_filters', message: 'Expected 3 filter values', type: 'value_error' },
    { field: 'config.learning_rate', message: 'Input should be greater than or equal to 0.00001' },
  ]
  const error = new ApiError(422, 'Unprocessable Entity', {
    error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', details },
  })
  assert.equal(error.status, 422)
  assert.equal(error.code, 'VALIDATION_ERROR')
  assert.equal(error.details, details)
  assert.match(error.message, /config.conv_filters: Expected 3 filter values/)
  assert.match(error.message, /config.learning_rate: Input should be greater/)
})

test('root-level validation and dataset errors keep their explanation', () => {
  const error = new ApiError(400, 'Bad Request', {
    error: { message: 'Dataset invalid.', details: [{ message: 'Not enough images.' }] },
  })
  assert.equal(error.message, 'Dataset invalid.\nNot enough images.')
})

test('non-JSON server errors have a usable HTTP fallback', () => {
  for (const body of [undefined, null, 'Bad Gateway', {}, { error: null }]) {
    const error = new ApiError(502, 'Bad Gateway', body)
    assert.equal(error.message, 'HTTP error 502: Bad Gateway')
  }
})
