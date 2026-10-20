import type { TrainingConfigState } from '@/types/api'

export function mergeTrainingConfig(current: TrainingConfigState, patch: Partial<TrainingConfigState>): TrainingConfigState {
  const config = { ...current, ...patch }
  const filters = config.conv_filters.slice(0, config.conv_blocks)
  while (filters.length < config.conv_blocks) {
    filters.push(filters.length ? Math.min(filters[filters.length - 1] * 2, 128) : 16)
  }
  return { ...config, conv_filters: filters }
}
