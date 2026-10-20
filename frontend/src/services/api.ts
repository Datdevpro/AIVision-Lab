import type {
  CompareResult,
  DatasetResponse,
  Experiment,
  FeedbackStats,
  Insight,
  ParamEstimate,
  ParameterSpec,
  PredictionResult,
  Project,
  Subset,
  SystemCapabilities,
  TrainingConfigState,
  TrainingJob,
} from '@/types/api'
import { requestJson } from './api-request'

const API_BASE = '/api'

const request = <T>(endpoint: string, options: RequestInit = {}, timeoutMs?: number) =>
  requestJson<T>(`${API_BASE}${endpoint}`, options, timeoutMs)

export const api = {
  // System
  getCapabilities: () => request<SystemCapabilities>('/system/capabilities', {}, 30_000),
  getParameters: () => request<{ parameters: ParameterSpec[] }>('/system/parameters'),
  prefetchWeights: () => request<{ pretrained_weights_cached: boolean }>('/system/prefetch-weights', { method: 'POST' }, 120_000),

  // Projects
  listProjects: () => request<Project[]>('/projects'),
  createProject: (name: string, default_classes = true) =>
    request<Project>('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, default_classes }),
    }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // Classes & Dataset
  getDataset: (projectId: string, strategy = 'random', valSplit = 0.2, seed = 42) =>
    request<DatasetResponse>(
      `/projects/${projectId}/dataset?strategy=${strategy}&val_split=${valSplit}&seed=${seed}`
    ),
  addClass: (projectId: string, name: string) =>
    request<{ id: string; name: string; position: number }>(`/projects/${projectId}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  renameClass: (classId: string, name: string) =>
    request<{ id: string; name: string }>(`/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  deleteClass: (classId: string) => request<void>(`/classes/${classId}`, { method: 'DELETE' }),
  clearClassImages: (classId: string) =>
    request<{ deleted: number }>(`/classes/${classId}/images`, { method: 'DELETE' }),

  // Images
  uploadImages: (
    projectId: string,
    classId: string,
    files: File[],
    subset: Subset = 'train',
    sessionId?: string | null,
    source: 'upload' | 'webcam' = 'upload'
  ) => {
    const formData = new FormData()
    formData.append('class_id', classId)
    formData.append('subset', subset)
    formData.append('source', source)
    if (sessionId) formData.append('session_id', sessionId)
    for (const f of files) {
      formData.append('files', f)
    }
    return request<{ accepted: number; rejected: number; results: any[] }>(
      `/projects/${projectId}/images`,
      {
        method: 'POST',
        body: formData,
      }, 120_000
    )
  },
  deleteImage: (imageId: string) => request<void>(`/images/${imageId}`, { method: 'DELETE' }),
  clearImages: (projectId: string) =>
    request<{ deleted: number }>(`/projects/${projectId}/images`, { method: 'DELETE' }),
  getImageUrl: (imageId: string, thumb = true) => `${API_BASE}/images/${imageId}/file?thumb=${thumb}`,

  // Training
  estimateParams: (config: TrainingConfigState, numClasses: number) =>
    request<ParamEstimate>('/training/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, num_classes: numClasses }),
    }),
  startTraining: (projectId: string, config: TrainingConfigState, experimentName?: string) =>
    request<TrainingJob>('/training/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, config, experiment_name: experimentName }),
    }),
  getActiveJob: () => request<{ job: TrainingJob | null }>('/training/active'),
  getJob: (jobId: string) => request<TrainingJob>(`/training/${jobId}`),
  cancelJob: (jobId: string) => request<TrainingJob>(`/training/${jobId}/cancel`, { method: 'POST' }),
  getJobInsights: (jobId: string) => request<{ insights: Insight[] }>(`/training/${jobId}/insights`),

  // Experiments
  listExperiments: (projectId?: string) =>
    request<Experiment[]>(`/experiments${projectId ? `?project_id=${projectId}` : ''}`),
  getExperiment: (id: string) => request<Experiment>(`/experiments/${id}`),
  getCompare: (a: string, b: string) => request<CompareResult>(`/experiments/compare?a=${a}&b=${b}`),
  getExperimentInsights: (id: string) =>
    request<{ insights: Insight[] }>(`/experiments/${id}/insights`),
  deleteExperiment: (id: string) => request<void>(`/experiments/${id}`, { method: 'DELETE' }),
  getExportUrl: (experimentId: string, format: 'checkpoint' | 'metadata' | 'labels' | 'metrics_csv' | 'onnx') =>
    `${API_BASE}/models/${experimentId}/export?format=${format}`,

  // Inference
  predict: (experimentId: string, imageFile: File | Blob) => {
    const formData = new FormData()
    formData.append('experiment_id', experimentId)
    formData.append('image', imageFile, 'capture.jpg')
    return request<PredictionResult>('/inference/predict', {
      method: 'POST',
      body: formData,
    })
  },
  submitFeedback: (experimentId: string, predictedLabel: string, correct: boolean, trueLabel?: string, confidence?: number) =>
    request<FeedbackStats>('/inference/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiment_id: experimentId, predicted_label: predictedLabel, correct, true_label: trueLabel, confidence }),
    }),
  getFeedbackStats: (experimentId: string) => request<FeedbackStats>(`/inference/feedback/${experimentId}`),
}
