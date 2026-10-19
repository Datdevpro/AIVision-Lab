import type { TrainingJob } from '@/types/api'

export const trainingStatusLabels: Record<TrainingJob['status'], string> = {
  idle: 'Chưa bắt đầu', preparing: 'Đang chuẩn bị', training: 'Đang huấn luyện',
  validating: 'Đang kiểm tra', completed: 'Đã hoàn tất', cancelled: 'Đã hủy', failed: 'Huấn luyện thất bại',
}

// One illustrative sweep, independent of the backend's batch execution speed.
export function getFlowFrame(step: number, layerCount: number, backward: boolean, backwardStart = 0) {
  const edges = layerCount - 1
  const cycle = edges + (backward ? edges - backwardStart : 0)
  const position = step % cycle
  return position < edges
    ? { edge: position, reverse: false }
    : { edge: edges - 1 - (position - edges), reverse: true }
}

export function isFlowRunning(status: TrainingJob['status'] | undefined) {
  return status === 'training' || status === 'validating'
}
