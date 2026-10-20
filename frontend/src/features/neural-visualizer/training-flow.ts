import type { TrainingJob } from '@/types/api'

export const trainingStatusLabels: Record<TrainingJob['status'], string> = {
  idle: 'Chưa bắt đầu', preparing: 'Đang chuẩn bị', training: 'Đang huấn luyện',
  validating: 'Đang kiểm tra', completed: 'Đã hoàn tất', cancelled: 'Đã hủy', failed: 'Huấn luyện thất bại',
}

export type FlowFrame = { edge: number; reverse: boolean }

// Keep the current edge when training/validation changes. Recomputing a modulo
// against different cycle lengths can skip the final connection entirely.
export function advanceFlowFrame(frame: FlowFrame, layerCount: number, backward: boolean, backwardStart = 0): FlowFrame {
  const lastEdge = layerCount - 2
  if (frame.reverse) {
    return backward && frame.edge > backwardStart
      ? { edge: frame.edge - 1, reverse: true }
      : { edge: 0, reverse: false }
  }
  if (frame.edge < lastEdge) return { edge: frame.edge + 1, reverse: false }
  return backward
    ? { edge: lastEdge, reverse: true }
    : { edge: 0, reverse: false }
}

export function isFlowRunning(status: TrainingJob['status'] | undefined) {
  return status === 'training' || status === 'validating'
}
