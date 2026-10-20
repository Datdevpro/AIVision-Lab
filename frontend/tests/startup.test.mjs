import assert from 'node:assert/strict'
import test from 'node:test'
import { loadStartupResources } from '../src/services/startup.ts'

test('training controls load immediately while hardware detection is still pending', async () => {
  let finishHardware
  let parametersLoaded = false
  let hardwareLoaded = false
  const pending = loadStartupResources({
    hardware: async () => { await new Promise(resolve => { finishHardware = resolve }); hardwareLoaded = true },
    parameters: async () => { parametersLoaded = true },
  })
  await Promise.resolve()
  assert.equal(parametersLoaded, true)
  assert.equal(hardwareLoaded, false)
  finishHardware()
  assert.deepEqual(await pending, [])
})

test('failed startup reports the cause, keeps successful data and can recover on retry', async t => {
  t.mock.method(console, 'error', () => {})
  let available = false
  let parametersLoaded = false
  const tasks = {
    projects: async () => { if (!available) throw new Error('backend unavailable') },
    parameters: async () => { parametersLoaded = true },
  }
  assert.deepEqual(await loadStartupResources(tasks), ['projects: backend unavailable'])
  assert.equal(parametersLoaded, true)
  available = true
  assert.deepEqual(await loadStartupResources(tasks), [])
})
