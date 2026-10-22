import type { TrainingJob } from '@/types/api'

export const trainingStatusLabels: Record<TrainingJob['status'], string> = {
  idle: 'Chưa bắt đầu', preparing: 'Đang chuẩn bị', training: 'Đang huấn luyện',
  validating: 'Đang kiểm tra', completed: 'Đã hoàn tất', cancelled: 'Đã hủy', failed: 'Huấn luyện thất bại',
}

export function isFlowRunning(status: TrainingJob['status'] | undefined) {
  return status === 'training' || status === 'validating'
}
