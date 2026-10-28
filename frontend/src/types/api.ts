export type Mode = 'beginner' | 'intermediate' | 'advanced'
export type Optimizer = 'adam' | 'sgd'
export type Activation = 'relu' | 'gelu' | 'tanh'
export type SplitStrategy = 'random' | 'explicit'
export type Architecture = 'mobilenet_v3_small' | 'custom_cnn' | 'tiny_test'
export type Subset = 'train' | 'val' | 'test'

export interface Project {
  id: string
  name: string
  created_at: string
  num_classes: number
  num_images: number
  latest_experiment_id: string | null
}

export interface ClassItem {
  id: string
  project_id: string
  name: string
  position: number
  images: ImageItem[]
}

export interface ImageItem {
  id: string
  class_id: string
  subset: Subset
  session_id: string | null
  source: 'upload' | 'webcam' | 'sample'
  original_name: string
  original_width: number
  original_height: number
  width: number
  height: number
  created_at: string
}

export interface DatasetWarning {
  code: string
  severity: 'error' | 'warning' | 'info'
  title: string
  message: string
  lesson?: string | null
}

export interface ClassCountSummary {
  class_id: string
  name: string
  total: number
  train: number
  val: number
  test: number
  unused: number
}

export interface DatasetSummary {
  num_classes: number
  total_images: number
  per_class: ClassCountSummary[]
  split: {
    strategy: SplitStrategy
    val_split: number
    seed: number
    train: number
    val: number
    test: number
    unused: number
  }
  balance: {
    min: number
    max: number
    train_ratio: number | null
  }
  warnings: DatasetWarning[]
  dataset_fingerprint: string
  split_fingerprint: string
}

export interface DatasetResponse {
  project_id: string
  classes: ClassItem[]
  summary: DatasetSummary
  sample_source?: SampleDatasetSource | null
}

export interface SampleDatasetSource {
  id: string
  name: string
  source_url: string
  class_ids: string[]
  images_per_class: number
  imported_images: number
  seed: number
}

export interface SampleDataset {
  id: string
  name: string
  description: string
  source_url: string
  download_bytes: number
  cached: boolean
  min_classes: number
  max_classes: number
  min_images_per_class: number
  max_images_per_class: number
  max_images_per_project: number
  classes: { id: string; name: string; available: number; preview_url: string }[]
}

export interface SampleImportJob {
  id: string
  status: 'preparing' | 'downloading' | 'extracting' | 'importing' | 'completed' | 'failed'
  message: string
  downloaded_bytes: number
  download_bytes: number
  imported_images: number
  total_images: number
  project_id: string | null
  error: string | null
}

export interface TrainingConfigState {
  mode: Mode
  epochs: number
  batch_size: number
  learning_rate: number
  optimizer: Optimizer
  weight_decay: number
  dropout: number
  val_split: number
  augmentation: boolean
  dense_layers: number
  neurons: number
  activation: Activation
  seed: number
  split_strategy: SplitStrategy
  early_stopping_patience: number
  conv_blocks: number
  conv_filters: number[]
  test_backbone?: boolean
}

export interface ParamEstimate {
  extractor_params: number
  head_params: number
  total_params: number
  trainable_params: number
  frozen_params: number
  feature_dim: number
  architecture: Architecture
  freeze_backbone: boolean
  input_size: number
  limit?: number | null
  within_limit: boolean
}

export interface BatchMetrics {
  epoch: number
  batch: number
  total_batches: number
  loss: number
  accuracy: number
}

export interface EpochMetrics {
  epoch: number
  total_epochs: number
  train_loss: number
  val_loss: number
  train_accuracy: number
  val_accuracy: number
  learning_rate: number
  elapsed_s: number
}

export interface TrainingJob {
  id: string
  project_id: string
  status: 'idle' | 'preparing' | 'training' | 'validating' | 'completed' | 'cancelled' | 'failed'
  message?: string | null
  config: TrainingConfigState
  dataset_summary: DatasetSummary
  epochs: EpochMetrics[]
  total_epochs: number
  progress: number
  batch?: BatchMetrics | null
  device?: string | null
  device_name?: string | null
  param_counts?: Record<string, number> | null
  error?: { code: string; message: string; details?: string } | null
  experiment_id?: string | null
  elapsed_s: number
  created_at?: string | null
}

export interface PerClassEval {
  label: string
  precision: number
  recall: number
  f1: number
  support: number
}

export interface MisclassifiedImage {
  image_id: string
  true_label: string
  predicted_label: string
  confidence: number
  true_class_probability: number
}

export interface SplitEvaluation {
  num_samples: number
  accuracy: number
  precision_macro: number
  recall_macro: number
  f1_macro: number
  mean_confidence: number
  mean_confidence_correct: number | null
  mean_confidence_wrong: number | null
  per_class: PerClassEval[]
  confusion_matrix: number[][]
  labels: string[]
  misclassified: MisclassifiedImage[]
  warnings: string[]
}

export interface ExperimentEvaluation {
  validation: SplitEvaluation | null
  test: SplitEvaluation | null
  checkpoint_epoch?: number
  stopped_early?: boolean
  split_sizes?: Record<string, number>
  feature_cache?: boolean
}

export interface Experiment {
  id: string
  project_id: string
  name: string
  mode: Mode
  architecture: Architecture
  created_at: string
  seed: number
  duration_s: number
  device: string
  config: TrainingConfigState
  class_names: string[]
  dataset_fingerprint: string
  split_fingerprint: string
  best_epoch: number | null
  best_val_accuracy: number | null
  best_val_loss: number | null
  final_train_accuracy: number | null
  test_accuracy: number | null
  num_epochs: number
  param_counts: Record<string, number>
  dataset_summary?: DatasetSummary
  epoch_metrics?: EpochMetrics[]
  best_checkpoint?: {
    epoch: number
    val_accuracy: number
    val_loss: number
    train_accuracy: number
    train_loss: number
    criterion: string
    file: string
  }
  evaluation?: ExperimentEvaluation
  metadata?: Record<string, unknown>
}

export interface CompareResult {
  a: Experiment
  b: Experiment
  config_diff: { key: string; a: unknown; b: unknown }[]
  same_dataset: boolean
  same_split: boolean
  fair: boolean
  warnings: string[]
  best_by_validation: 'a' | 'b' | 'tie'
  best_basis: string
}

export interface PredictionItem {
  index: number
  label: string
  probability: number
}

export interface PredictionResult {
  experiment_id: string
  predicted_index: number
  predicted_label: string
  confidence: number
  probabilities: PredictionItem[]
  latency_ms: number
  total_ms: number
  device: string
  note: string
}

export interface FeedbackStats {
  experiment_id: string
  total: number
  correct: number
  accuracy: number | null
}

export interface Insight {
  id: string
  severity: 'success' | 'warning' | 'info'
  title: string
  message: string
  evidence: Record<string, unknown>
  lesson?: string | null
}

export interface ParameterSpec {
  key: string
  name_vi: string
  name_en: string
  type: 'int' | 'float' | 'enum' | 'bool' | 'int_list'
  min?: number
  max?: number
  step?: number | null
  scale?: 'log'
  default: unknown
  options?: { value: string | number; label: string }[] | number[]
  description: string
  tooltip: string
  tradeoff_low: string
  tradeoff_high: string
  lesson: string | null
  modes: Mode[]
}

export interface LearningModeInfo {
  id: Mode
  name_vi: string
  name_en: string
  enabled: boolean
  description: string
  architecture: string
}

export interface SystemCapabilities {
  device: {
    type: string
    cuda_available: boolean
    name: string
    vram_gb: number | null
    preference: string
  }
  torch_version: string
  torchvision_version: string
  pretrained_weights_cached: boolean
  onnx_available: boolean
  modes: LearningModeInfo[]
  advanced_mode_enabled: boolean
  training_busy: boolean
  limits: {
    max_upload_mb: number
    max_image_dimension: number
    max_images_per_class: number
    max_images_per_project: number
    max_classes: number
    max_files_per_request: number
    max_epochs: number
    max_batch_size: number
    max_custom_cnn_params: number
    allowed_image_types: string[]
  }
  privacy: string
  auth_required: boolean
}
