import assert from 'node:assert/strict'
import test from 'node:test'
import { scoreModel } from '../src/features/analytics/model-score.ts'

const fixture = () => ({
  class_names: ['Táo', 'Cam', 'Lê'],
  best_val_loss: Math.log(3) / 2,
  evaluation: { validation: {
    num_samples: 300, accuracy: 0.85, f1_macro: 0.84,
    per_class: [
      { label: 'Táo', f1: 0.9, recall: 0.7, support: 100 },
      { label: 'Cam', f1: 0.85, recall: 0.85, support: 100 },
      { label: 'Lê', f1: 0.77, recall: 0.95, support: 100 },
    ],
  } },
})

test('weights and contributions match the four agreed criteria', () => {
  const result = scoreModel(fixture())
  assert.deepEqual(result.rows.map(row => row.weight), [35, 20, 20, 25])
  assert.equal(result.weakest.label, 'Táo')
  assert.deepEqual(result.rows.map(row => row.points), [29.75, 16.8, 14, 12.5])
  assert.ok(Math.abs(result.total - 73.05) < 1e-10)
})

test('weakest-class scoring accepts zero recall and rejects missing or invalid recall', () => {
  for (const recall of [0, 1, undefined, null, NaN, Infinity, -0.1, 1.1]) {
    const experiment = fixture()
    experiment.evaluation.validation.per_class.forEach(item => { item.recall = recall })
    const result = scoreModel(experiment)
    if (recall === 0 || recall === 1) {
      assert.equal(result.rows[2].points, recall * 20)
      assert.notEqual(result.total, null)
    } else {
      assert.equal(result.rows[2].points, null)
      assert.equal(result.total, null)
      assert.equal(result.rows[1].points, 16.8)
    }
  }
})

test('uniform predictions earn zero loss points for any supported class count', () => {
  for (const count of [2, 3, 5, 12]) {
    const experiment = fixture()
    experiment.class_names = Array.from({ length: count }, (_, i) => `Class ${i}`)
    experiment.best_val_loss = Math.log(count)
    assert.equal(scoreModel(experiment).rows[3].points, 0)
  }
})

test('loss points range from 25 at zero loss to zero above the uniform baseline', () => {
  const experiment = fixture()
  experiment.best_val_loss = 0
  assert.equal(scoreModel(experiment).rows[3].points, 25)
  experiment.best_val_loss = 100
  assert.equal(scoreModel(experiment).rows[3].points, 0)
})

test('loss is taken from the selected checkpoint, never the last epoch or minimum loss', () => {
  const experiment = fixture()
  experiment.best_checkpoint = { val_loss: Math.log(3) / 4 }
  experiment.epoch_metrics = [{ val_loss: 0.001 }, { val_loss: 0.002 }]
  assert.equal(scoreModel(experiment).rows[3].points, 18.75)
})

test('missing, invalid or negative loss does not produce a total score', () => {
  for (const loss of [null, undefined, NaN, Infinity, -1]) {
    const experiment = fixture()
    experiment.best_val_loss = loss
    const result = scoreModel(experiment)
    assert.equal(result.rows[3].points, null)
    assert.equal(result.total, null)
  }
})

test('every class needs evaluation support; zero support is not a perfect or zero score', () => {
  const experiment = fixture()
  experiment.evaluation.validation.per_class[2].support = 0
  assert.equal(scoreModel(experiment).weakest, null)
  assert.equal(scoreModel(experiment).total, null)
  experiment.evaluation.validation.per_class.pop()
  assert.equal(scoreModel(experiment).total, null)
})

test('missing or empty validation and invalid metrics remain unscored', () => {
  const experiment = fixture()
  experiment.evaluation.validation.accuracy = NaN
  assert.equal(scoreModel(experiment).total, null)
  experiment.evaluation.validation.num_samples = 0
  assert.ok(scoreModel(experiment).rows.every(row => row.points === null))
  experiment.evaluation.validation = null
  assert.equal(scoreModel(experiment).total, null)
})
