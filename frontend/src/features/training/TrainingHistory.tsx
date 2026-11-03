import React, { useEffect, useState } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'
import { formatNumber, formatPercent } from '@/lib/utils'
import type { Experiment } from '@/types/api'
import { ModelEvaluationView } from '@/features/analytics/ModelEvaluationView'

const dateLabel = (value: string) => {
  // Backend stores UTC timestamps without an offset in SQLite.
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

const HistoryReport: React.FC<{ id: string }> = ({ id }) => {
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [split, setSplit] = useState<'validation' | 'test'>('validation')
  useEffect(() => {
    let cancelled = false
    setError('')
    api.getExperiment(id).then(result => {
      if (!cancelled) setExperiment(result)
    }).catch((e: Error) => { if (!cancelled) setError(e.message || 'Không tải được kết quả.') })
    return () => { cancelled = true }
  }, [id, retry])

  if (error) return <div role="alert" className="p-4 text-sm text-rose-500">{error} <button className="underline" onClick={() => setRetry(n => n + 1)}>Thử lại</button></div>
  if (!experiment) return <p role="status" className="p-4 text-sm">Đang tải kết quả huấn luyện…</p>

  return <article aria-label={`Kết quả ${experiment.name}`} className="min-w-0 p-3">
    <h3 className="font-bold text-sm">{experiment.name}</h3>
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
      <span>Random seed: <strong className="font-mono">{experiment.seed}</strong></span>
      <span>{dateLabel(experiment.created_at)}</span>
      <span>{experiment.num_epochs} epoch · {formatNumber(experiment.duration_s)} giây · {experiment.device}</span>
      <span>Epoch tốt nhất: {experiment.best_epoch ?? '—'}</span>
    </div>
    <details className="text-xs mt-3">
      <summary className="cursor-pointer font-semibold">Cấu hình và dữ liệu lúc huấn luyện</summary>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
        <span>Mô hình: {experiment.architecture}</span>
        <span>Learning rate: {experiment.config.learning_rate}</span>
        <span>Batch size: {experiment.config.batch_size}</span>
        <span>Optimizer: {experiment.config.optimizer}</span>
        <span>Chia validation: {experiment.config.split_strategy === 'explicit' ? 'Validation riêng' : `Ngẫu nhiên (${formatPercent(experiment.config.val_split)})`}</span>
        <span>{experiment.class_names.length} lớp · Train: {experiment.dataset_summary?.split.train ?? '—'} · Validation: {experiment.dataset_summary?.split.val ?? '—'}</span>
        <span className="break-all">Mã dữ liệu: {experiment.dataset_fingerprint} · Mã chia tập: {experiment.split_fingerprint}</span>
      </div>
    </details>
    <div className="flex gap-2 mt-4" role="group" aria-label="Tập đánh giá lịch sử">
      {(['validation', 'test'] as const).filter(value => value === 'validation' || experiment.evaluation?.test).map(value =>
        <button key={value} aria-pressed={split === value} onClick={() => setSplit(value)} className={`px-3 py-1.5 rounded-lg border text-xs ${split === value ? 'border-cyan-500 text-cyan-600 bg-cyan-500/10' : 'border-slate-500/30'}`}>
          {value === 'validation' ? 'Kết quả Validation' : 'Kết quả Test'}
        </button>)}
    </div>
    <p className="text-xs opacity-70 mt-2">Kết quả của checkpoint tốt nhất. Macro average là trung bình trên các lớp, mỗi lớp có trọng số bằng nhau.</p>
    <ModelEvaluationView experiment={experiment} split={split} />
  </article>
}

const ProjectHistory: React.FC<{ projectId: string | null }> = ({ projectId }) => {
  const theme = useLabStore(state => state.theme)
  const job = useLabStore(state => state.activeJob)
  const [list, setList] = useState<Experiment[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const light = theme === 'light'
  const completedJob = job?.project_id === projectId && job.status === 'completed' ? job.id : null

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setLoading(true)
    setError('')
    api.listExperiments(projectId).then(results => {
      if (cancelled) return
      setList(results)
      setSelectedId(previous => results.some(item => item.id === previous) ? previous : results[0]?.id ?? null)
    }).catch((e: Error) => {
      if (!cancelled) setError(e.message || 'Không tải được lịch sử.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId, completedJob, refresh])

  return <section aria-label="Lịch sử huấn luyện" className={`rounded-xl ${light ? 'bg-white text-slate-900' : 'bg-[#0c1019] text-slate-200'}`}>
    <div className="flex items-center px-4 h-10 gap-3">
      <h2 className="flex flex-1 items-center gap-2 text-xs font-semibold">
        <History size={15} /> Lịch sử training
        <span className="font-mono opacity-60">({list.length})</span>
      </h2>
      {projectId && <button title="Làm mới lịch sử" aria-label="Làm mới lịch sử" disabled={loading} onClick={() => setRefresh(value => value + 1)} className="p-1.5 disabled:opacity-40"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>}
    </div>
    <div className="border-t border-slate-500/20">
      {!projectId ? <p className="p-4 text-xs">Chọn dự án để xem lịch sử huấn luyện.</p>
        : error ? <p role="alert" className="p-4 text-sm text-rose-500">{error} <button onClick={() => setRefresh(value => value + 1)} className="underline">Thử lại</button></p>
        : loading ? <p role="status" className="p-4 text-xs">Đang tải lịch sử…</p>
        : list.length === 0 ? <p className="p-4 text-xs">Dự án chưa có lần huấn luyện hoàn tất. Kết quả sẽ được lưu tại đây sau khi huấn luyện thành công.</p>
        : <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Các lần huấn luyện" className="max-h-[52vh] overflow-y-auto p-2 space-y-2 border-r border-slate-500/20">
            {list.map(item => <button key={item.id} aria-current={selectedId === item.id ? 'true' : undefined} onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-left text-xs space-y-1 ${selectedId === item.id ? 'border-cyan-500 bg-cyan-500/10' : light ? 'border-slate-200 hover:bg-slate-50' : 'border-white/10 hover:bg-white/5'}`}>
              <div className="font-bold break-words">{item.name}</div>
              <div className="opacity-70">{dateLabel(item.created_at)}</div>
              <div className="font-mono">Seed: {item.seed} · {item.num_epochs} epoch</div>
              <div>Val accuracy: <strong>{formatPercent(item.best_val_accuracy)}</strong></div>
            </button>)}
          </nav>
          <div className="min-w-0">{selectedId && <HistoryReport key={selectedId} id={selectedId} />}</div>
        </div>}
    </div>
  </section>
}

export const TrainingHistory: React.FC = () => {
  const projectId = useLabStore(state => state.currentProject?.id ?? null)
  return <ProjectHistory key={projectId ?? 'no-project'} projectId={projectId} />
}
