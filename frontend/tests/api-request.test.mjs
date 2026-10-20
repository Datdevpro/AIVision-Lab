import assert from 'node:assert/strict'
import test from 'node:test'
import { requestJson } from '../src/services/api-request.ts'

test('a hung backend times out instead of leaving the workspace loading forever', async t => {
  t.mock.method(console, 'error', () => {})
  let aborted = false
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')) })
  }))
  await assert.rejects(requestJson('/api/projects', {}, 10), /Backend không phản hồi.*\/api\/projects/)
  assert.equal(aborted, true)
})

test('startup network failures explain that the backend cannot be reached', async t => {
  t.mock.method(console, 'error', () => {})
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed') })
  await assert.rejects(requestJson('/api/system/parameters'), /Không kết nối được backend/)
})

test('successful requests preserve headers and deserialize the response', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Accept, 'application/json')
    assert.equal(options.headers['Content-Type'], 'application/json')
    return Response.json({ parameters: ['epochs'] })
  })
  assert.deepEqual(await requestJson('/api/system/parameters', { headers: { 'Content-Type': 'application/json' } }), { parameters: ['epochs'] })
})

test('HTTP errors retain their validation code and field details', async t => {
  t.mock.method(console, 'error', () => {})
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: {
    code: 'VALIDATION_ERROR', message: 'Invalid input', details: [{ field: 'config', message: 'invalid filters' }],
  } }, { status: 422 }))
  await assert.rejects(requestJson('/api/training/start'), error => {
    assert.equal(error.code, 'VALIDATION_ERROR')
    assert.match(error.message, /config: invalid filters/)
    return true
  })
})

test('caller cancellation remains distinguishable from backend timeout', async t => {
  t.mock.method(console, 'error', () => {})
  const caller = new AbortController()
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))
  }))
  const pending = requestJson('/api/projects', { signal: caller.signal })
  caller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
})
