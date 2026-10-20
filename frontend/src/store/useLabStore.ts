import { create } from 'zustand'
import { api } from '@/services/api'
import { mergeTrainingConfig } from '@/features/training/training-config'
import { loadStartupResources } from '@/services/startup'
import type {
  DatasetResponse,
  EpochMetrics,
  Experiment,
  FeedbackStats,
  Mode,
  ParamEstimate,
  ParameterSpec,
  PredictionResult,
  Project,
  SystemCapabilities,
  TrainingConfigState,
  TrainingJob,
} from '@/types/api'

export type BottomTab = 'metrics' | 'architecture' | 'evaluation' | 'experiments' | 'insights' | 'lessons'

interface LabState {
  // System
  capabilities: SystemCapabilities | null
  paramSpecs: ParameterSpec[]
  fetchSystem: () => Promise<string[]>
  initializationStatus: 'loading' | 'ready' | 'error'
  initializationError: string | null
  initializeApp: () => Promise<void>

  // Project
  currentProject: Project | null
  projects: Project[]
  loadProjects: () => Promise<boolean>
  setCurrentProject: (p: Project) => void
  createProject: (name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // Dataset
  dataset: DatasetResponse | null
  selectedClassId: string | null
  isDatasetLoading: boolean
  loadDataset: () => Promise<void>
  setSelectedClassId: (id: string | null) => void

  // Training Config
  config: TrainingConfigState
  paramEstimate: ParamEstimate | null
  setMode: (mode: Mode) => void
  updateConfig: (patch: Partial<TrainingConfigState>) => void
  fetchEstimate: () => Promise<void>

  // Training Job & WS
  activeJob: TrainingJob | null
  isTraining: boolean
  ws: WebSocket | null
  startTraining: (experimentName?: string) => Promise<void>
  cancelTraining: () => Promise<void>
  checkActiveJob: () => Promise<void>
  connectWebSocket: (jobId: string) => void
  disconnectWebSocket: () => void

  // Active Experiment & Evaluation
  activeExperiment: Experiment | null
  experiments: Experiment[]
  loadExperiments: () => Promise<void>
  setActiveExperiment: (exp: Experiment | null) => void
  loadExperimentDetails: (id: string) => Promise<void>

  // Live Inference
  isWebcamActive: boolean
  setWebcamActive: (active: boolean) => void
  lastPrediction: PredictionResult | null
  isPredicting: boolean
  feedbackStats: FeedbackStats | null
  predictImage: (file: File | Blob) => Promise<PredictionResult | null>
  submitFeedback: (correct: boolean, trueLabel?: string) => Promise<void>
  loadFeedbackStats: (expId: string) => Promise<void>

  // UI state
  activeBottomTab: BottomTab
  setActiveBottomTab: (tab: BottomTab) => void
  selectedLessonKey: string | null
  setSelectedLessonKey: (key: string | null) => void
  errorBanner: string | null
  setErrorBanner: (msg: string | null) => void
  hasAttemptedTraining: boolean
  setHasAttemptedTraining: (attempted: boolean) => void
  theme: 'dark' | 'light'
  setTheme: (theme: 'dark' | 'light') => void
  toggleTheme: () => void
}

const DEFAULT_CONFIG: TrainingConfigState = {
  mode: 'beginner',
  epochs: 10,
  batch_size: 16,
  learning_rate: 0.001,
  optimizer: 'adam',
  weight_decay: 0.0,
  dropout: 0.2,
  val_split: 0.2,
  augmentation: true,
  dense_layers: 1,
  neurons: 64,
  activation: 'relu',
  seed: 42,
  split_strategy: 'random',
  early_stopping_patience: 0,
  conv_blocks: 2,
  conv_filters: [16, 32],
}

let initializationPromise: Promise<void> | null = null

export const useLabStore = create<LabState>((set, get) => ({
  capabilities: null,
  paramSpecs: [],
  initializationStatus: 'loading',
  initializationError: null,
  initializeApp: () => {
    if (initializationPromise) return initializationPromise
    set({ initializationStatus: 'loading' })
    initializationPromise = (async () => {
      const [errors, projectsLoaded] = await Promise.all([get().fetchSystem(), get().loadProjects()])
      if (!projectsLoaded) errors.push(get().errorBanner ?? 'Không tải được danh sách dự án.')
      set({ initializationStatus: errors.length ? 'error' : 'ready', initializationError: errors.length ? errors.join('\n') : null })
      // Job restore is independent of the resources needed to render the workspace.
      void get().checkActiveJob()
    })().finally(() => { initializationPromise = null })
    return initializationPromise
  },
  fetchSystem: () => loadStartupResources({
    'Thông tin thiết bị': async () => { set({ capabilities: await api.getCapabilities() }) },
    'Tham số huấn luyện': async () => { const result = await api.getParameters(); set({ paramSpecs: result.parameters }) },
  }),

  currentProject: null,
  projects: [],
  loadProjects: async () => {
    try {
      const list = await api.listProjects()
      set({ projects: list })
      const curr = get().currentProject
      if (!curr && list.length > 0) {
        set({ currentProject: list[0] })
        get().loadDataset()
        get().loadExperiments()
      } else if (curr) {
        const found = list.find((p) => p.id === curr.id)
        if (found) set({ currentProject: found })
      } else if (list.length === 0) {
        // Auto create first project if empty
        const created = await api.createProject('Dự án đầu tiên', true)
        set({ projects: [created], currentProject: created })
        get().loadDataset()
      }
      if (get().errorBanner?.startsWith('Không tải được danh sách dự án:')) set({ errorBanner: null })
      return true
    } catch (e) {
      set({ errorBanner: `Không tải được danh sách dự án: ${e instanceof Error ? e.message : String(e)}` })
      return false
    }
  },

  setCurrentProject: (p: Project) => {
    set({ currentProject: p, activeExperiment: null, lastPrediction: null, hasAttemptedTraining: false })
    get().loadDataset()
    get().loadExperiments()
  },

  createProject: async (name: string) => {
    try {
      const created = await api.createProject(name, true)
      await get().loadProjects()
      set({ currentProject: created })
      get().loadDataset()
      get().loadExperiments()
    } catch (e: any) {
      set({ errorBanner: e.message })
    }
  },

  deleteProject: async (id: string) => {
    try {
      await api.deleteProject(id)
      const remaining = get().projects.filter((p) => p.id !== id)
      const wasCurrent = get().currentProject?.id === id
      const nextCurrent = wasCurrent ? (remaining[0] || null) : get().currentProject
      set({
        projects: remaining,
        currentProject: nextCurrent,
        ...(wasCurrent ? { dataset: null, activeExperiment: null, lastPrediction: null, hasAttemptedTraining: false } : {}),
      })
      if (wasCurrent && nextCurrent) {
        get().loadDataset()
        get().loadExperiments()
      }
    } catch (e: any) {
      set({ errorBanner: e.message })
    }
  },

  dataset: null,
  selectedClassId: null,
  isDatasetLoading: false,
  loadDataset: async () => {
    const proj = get().currentProject
    if (!proj) return
    set({ isDatasetLoading: true })
    try {
      const cfg = get().config
      const data = await api.getDataset(
        proj.id,
        cfg.split_strategy,
        cfg.val_split,
        cfg.seed
      )
      set({ dataset: data, isDatasetLoading: false })
      if (!get().selectedClassId && data.classes.length > 0) {
        set({ selectedClassId: data.classes[0].id })
      }
      get().fetchEstimate()
    } catch (e: any) {
      set({ isDatasetLoading: false, errorBanner: e.message })
    }
  },

  setSelectedClassId: (id: string | null) => set({ selectedClassId: id }),

  config: DEFAULT_CONFIG,
  paramEstimate: null,
  setMode: (mode: Mode) => {
    const cfg = mergeTrainingConfig(get().config, { mode })
    if (mode === 'beginner') {
      cfg.dense_layers = 1
      cfg.neurons = 64
      cfg.learning_rate = 0.001
      cfg.batch_size = 16
      cfg.optimizer = 'adam'
      cfg.activation = 'relu'
    }
    set({ config: cfg })
    get().fetchEstimate()
  },

  updateConfig: (patch: Partial<TrainingConfigState>) => {
    set((state) => ({ config: mergeTrainingConfig(state.config, patch) }))
    get().fetchEstimate()
  },

  fetchEstimate: async () => {
    const classes = get().dataset?.classes || []
    if (classes.length < 2) {
      set({ paramEstimate: null })
      return
    }
    try {
      const est = await api.estimateParams(get().config, classes.length)
      set({ paramEstimate: est })
    } catch (e) {
      // quiet fail on draft input
    }
  },

  activeJob: null,
  isTraining: false,
  ws: null,

  checkActiveJob: async () => {
    try {
      const res = await api.getActiveJob()
      if (res.job) {
        set({ activeJob: res.job, isTraining: true, activeBottomTab: 'metrics' })
        get().connectWebSocket(res.job.id)
      }
    } catch (e) {
      console.error('Check active job error:', e)
    }
  },

  startTraining: async (experimentName?: string) => {
    const proj = get().currentProject
    if (!proj) return
    const config = mergeTrainingConfig(get().config, {})
    set({ config, errorBanner: null })
    try {
      const job = await api.startTraining(proj.id, config, experimentName)
      set({ activeJob: job, isTraining: true, activeBottomTab: 'architecture', hasAttemptedTraining: false })
      get().connectWebSocket(job.id)
    } catch (e: any) {
      set({ hasAttemptedTraining: true, errorBanner: e.message || 'Không thể bắt đầu huấn luyện' })
    }
  },

  cancelTraining: async () => {
    const job = get().activeJob
    if (!job) return
    try {
      await api.cancelJob(job.id)
    } catch (e: any) {
      set({ errorBanner: e.message })
    }
  },

  connectWebSocket: (jobId: string) => {
    get().disconnectWebSocket()
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${proto}//${host}/ws/training/${jobId}`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const job = get().activeJob
        if (!job) return

        if (data.type === 'snapshot') {
          set({ activeJob: data.job })
          if (data.job.status === 'completed' || data.job.status === 'failed' || data.job.status === 'cancelled') {
            set({ isTraining: false })
            if (data.job.experiment_id) {
              get().loadExperiments()
              get().loadExperimentDetails(data.job.experiment_id)
            }
          }
        } else if (data.type === 'status') {
          set({
            activeJob: { ...job, status: data.status, message: data.message },
          })
        } else if (data.type === 'device') {
          set({
            activeJob: { ...job, device: data.device, device_name: data.device_name },
          })
        } else if (data.type === 'model') {
          set({
            activeJob: { ...job, param_counts: data.param_counts },
          })
        } else if (data.type === 'batch') {
          set({
            activeJob: {
              ...job,
              batch: {
                epoch: data.epoch,
                batch: data.batch,
                total_batches: data.total_batches,
                loss: data.loss,
                accuracy: data.accuracy,
              },
              progress: data.progress,
            },
          })
        } else if (data.type === 'epoch') {
          const newEpochs: EpochMetrics[] = [...(job.epochs || []), data.metrics]
          set({
            activeJob: {
              ...job,
              epochs: newEpochs,
              progress: data.metrics.epoch / job.total_epochs,
            },
          })
        } else if (data.type === 'job') {
          set({
            activeJob: data.job,
            isTraining: false,
          })
          if (data.job.experiment_id) {
            get().loadExperiments()
            get().loadExperimentDetails(data.job.experiment_id)
          }
        }
      } catch (err) {
        console.error('WS parse error:', err)
      }
    }

    ws.onerror = (e) => {
      console.warn('WS error:', e)
    }

    ws.onclose = () => {
      set({ ws: null })
    }

    set({ ws })
  },

  disconnectWebSocket: () => {
    const ws = get().ws
    if (ws) {
      ws.close()
      set({ ws: null })
    }
  },

  activeExperiment: null,
  experiments: [],
  loadExperiments: async () => {
    const proj = get().currentProject
    if (!proj) return
    try {
      const list = await api.listExperiments(proj.id)
      set({ experiments: list })
      if (!get().activeExperiment && list.length > 0) {
        get().loadExperimentDetails(list[0].id)
      }
    } catch (e: any) {
      console.error('Failed to load experiments:', e)
    }
  },

  setActiveExperiment: (exp: Experiment | null) => {
    set({ activeExperiment: exp, lastPrediction: null })
    if (exp) {
      get().loadFeedbackStats(exp.id)
    }
  },

  loadExperimentDetails: async (id: string) => {
    try {
      const detail = await api.getExperiment(id)
      set({ activeExperiment: detail })
      get().loadFeedbackStats(id)
    } catch (e: any) {
      console.error('Failed to load experiment detail:', e)
    }
  },

  isWebcamActive: false,
  setWebcamActive: (active: boolean) => set({ isWebcamActive: active }),
  lastPrediction: null,
  isPredicting: false,
  feedbackStats: null,

  predictImage: async (file: File | Blob) => {
    const exp = get().activeExperiment
    if (!exp) return null
    if (get().isPredicting) return null
    set({ isPredicting: true })
    try {
      const result = await api.predict(exp.id, file)
      set({ lastPrediction: result, isPredicting: false })
      return result
    } catch (e: any) {
      set({ isPredicting: false })
      return null
    }
  },

  submitFeedback: async (correct: boolean, trueLabel?: string) => {
    const exp = get().activeExperiment
    const pred = get().lastPrediction
    if (!exp || !pred) return
    try {
      const stats = await api.submitFeedback(
        exp.id,
        pred.predicted_label,
        correct,
        trueLabel,
        pred.confidence
      )
      set({ feedbackStats: stats })
    } catch (e: any) {
      console.error('Feedback error:', e)
    }
  },

  loadFeedbackStats: async (expId: string) => {
    try {
      const stats = await api.getFeedbackStats(expId)
      set({ feedbackStats: stats })
    } catch (e) {
      // quiet fail
    }
  },

  activeBottomTab: 'metrics',
  setActiveBottomTab: (tab: BottomTab) => set({ activeBottomTab: tab }),
  selectedLessonKey: null,
  setSelectedLessonKey: (key: string | null) => set({ selectedLessonKey: key }),
  errorBanner: null,
  setErrorBanner: (msg: string | null) => set({ errorBanner: msg }),
  hasAttemptedTraining: false,
  setHasAttemptedTraining: (attempted: boolean) => set({ hasAttemptedTraining: attempted }),

  theme: (typeof window !== 'undefined' && localStorage.getItem('visionlab_theme') === 'light' ? 'light' : 'dark') as 'dark' | 'light',
  setTheme: (theme: 'dark' | 'light') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('visionlab_theme', theme)
      document.documentElement.classList.toggle('light', theme === 'light')
      document.documentElement.classList.toggle('dark', theme === 'dark')
      document.documentElement.setAttribute('data-theme', theme)
    }
    set({ theme })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
}))
