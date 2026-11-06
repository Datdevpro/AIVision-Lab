import type { Experiment } from '../../types/api'

const ratio = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

export function scoreModel(experiment: Experiment) {
  const report = experiment.evaluation?.validation
  const classes = experiment.class_names.length
  const loss = experiment.best_checkpoint?.val_loss ?? experiment.best_val_loss
  const baselineLoss = classes > 1 ? Math.log(classes) : null
  const validReport = !!report && report.num_samples > 0
  const completeClasses = validReport && report.per_class?.length === classes && classes > 1 &&
    report.per_class.every(item => item.support > 0)
  const validRecall = completeClasses && report.per_class.every(item => ratio(item.recall))
  const weakest = validRecall ? report.per_class.reduce((a, b) => a.recall <= b.recall ? a : b) : null
  const accuracy = validReport && ratio(report.accuracy) ? report.accuracy : null
  const macro = completeClasses && ratio(report.f1_macro) ? report.f1_macro : null
  const validLoss = validReport && baselineLoss !== null && typeof loss === 'number' && Number.isFinite(loss) && loss >= 0
  const lossQuality = validLoss ? Math.max(0, Math.min(1, 1 - loss / baselineLoss)) : null
  const rows = [
    { key: 'accuracy', label: 'Overall Accuracy', weight: 35, quality: accuracy,
      description: 'Tỷ lệ dự đoán đúng trên toàn bộ ảnh validation.' },
    { key: 'macro', label: 'F1 Macro', weight: 20, quality: macro,
      description: 'Trung bình F1 của các lớp, mỗi lớp có trọng số ngang nhau.' },
    { key: 'weakest', label: 'Khả năng nhận diện lớp yếu nhất (Recall thấp nhất)', weight: 20, quality: weakest?.recall ?? null,
      description: weakest ? `Recall thấp nhất: lớp ${weakest.label} (${weakest.support} mẫu). Tỷ lệ nhận diện đúng trong số ảnh thực tế thuộc lớp này; càng cao càng ít bỏ sót.` : 'Cần đủ ảnh đánh giá và Recall cho mọi lớp.' },
    { key: 'loss', label: 'Overall Loss', weight: 25, quality: lossQuality,
      description: 'Cross-entropy loss trung bình trên validation của checkpoint tốt nhất; càng thấp càng tốt.' },
  ].map(row => ({ ...row, points: row.quality === null ? null : row.weight * row.quality }))
  const total = rows.every(row => row.points !== null) ? rows.reduce((sum, row) => sum + row.points!, 0) : null
  return { rows, total, loss: validLoss ? loss : null, baselineLoss, weakest, report }
}
