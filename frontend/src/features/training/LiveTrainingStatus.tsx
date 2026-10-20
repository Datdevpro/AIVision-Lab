import React from 'react'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Cpu,
  Flame,
  Loader2,
  StopCircle,
  Zap,
} from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'
import { formatNumber, formatPercent } from '@/lib/utils'

export const LiveTrainingStatus: React.FC = () => {
  const {
    dataset,
    activeJob,
    isTraining,
    startTraining,
    cancelTraining,
    errorBanner,
    setErrorBanner,
    setHasAttemptedTraining,
    theme,
  } = useLabStore()

  const summary = dataset?.summary
  const totalImages = summary?.total_images || 0
  const numClasses = summary?.num_classes || 0

  const handleStartTrain = () => {
    if (isTraining) return

    const classes = dataset?.classes || []

    // 1. Kiểm tra số lớp tối thiểu
    if (classes.length < 2) {
      setHasAttemptedTraining(true)
      setErrorBanner('Cần ít nhất 2 lớp để huấn luyện bộ phân loại ảnh.')
      return
    }

    // 2. Kiểm tra lớp không có ảnh
    const emptyClasses = classes.filter((c) => (c.images?.length || 0) === 0)
    if (emptyClasses.length > 0) {
      setHasAttemptedTraining(true)
      const names = emptyClasses.map((c) => `"${c.name}"`).join(', ')
      setErrorBanner(`Chưa thể huấn luyện: Lớp ${names} chưa có ảnh nào. Vui lòng chụp hoặc tải ảnh lên.`)
      return
    }

    // 3. Kiểm tra số lượng ảnh tối thiểu yêu cầu (cần tối thiểu 2 ảnh mỗi lớp để chia train và val)
    const insufficientClasses = classes.filter((c) => (c.images?.length || 0) < 2)
    if (insufficientClasses.length > 0) {
      setHasAttemptedTraining(true)
      const names = insufficientClasses.map((c) => `"${c.name}"`).join(', ')
      setErrorBanner(`Chưa thể huấn luyện: Lớp ${names} có quá ít ảnh (< 2 ảnh). Cần tối thiểu 2 ảnh mỗi lớp để phân chia dữ liệu.`)
      return
    }

    // 4. Kiểm tra tổng số ảnh toàn bộ dự án
    if (totalImages < 4) {
      setHasAttemptedTraining(true)
      setErrorBanner('Chưa thể huấn luyện: Tổng số ảnh toàn bộ dự án cần ít nhất 4 ảnh.')
      return
    }

    // Đạt đủ điều kiện:
    setHasAttemptedTraining(false)
    setErrorBanner(null)
    startTraining()
  }

  const latestEpoch = activeJob?.epochs && activeJob.epochs.length > 0
    ? activeJob.epochs[activeJob.epochs.length - 1]
    : null

  const status = activeJob?.status || 'idle'

  return (
    <div className="space-y-3">
      {/* Start / Cancel Action Buttons */}
      <div className="space-y-2">
        {isTraining ? (
          <button
            onClick={() => cancelTraining()}
            className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition animate-pulse"
          >
            <StopCircle className="w-4 h-4" />
            <span>Dừng huấn luyện (Cancel)</span>
          </button>
        ) : (
          <button
            onClick={handleStartTrain}
            className="w-full py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:to-purple-500 text-slate-950 shadow-cyan-500/25 scale-[1.01] hover:scale-[1.02] cursor-pointer"
          >
            <Flame className="w-4 h-4 text-amber-300 animate-bounce" />
            <span>Bắt đầu huấn luyện mô hình (Train Model)</span>
          </button>
        )}
      </div>

      {/* Error / Validation Warning Message */}
      {errorBanner && (
        <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in ${
          theme === 'light'
            ? 'bg-rose-50 border-rose-300 text-rose-950 font-medium shadow-sm'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${theme === 'light' ? 'text-rose-600' : 'text-rose-400'}`} />
          <span className="whitespace-pre-line break-words min-w-0">{errorBanner}</span>
        </div>
      )}

      {/* Live Training Card (shown during or after a run) */}
      {activeJob && status !== 'idle' && (
        <div className="rounded-2xl bg-[#0c1019] border border-cyan-500/30 p-3.5 space-y-3 shadow-xl">
          {/* Status Header */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              {isTraining ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              ) : status === 'completed' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400" />
              )}
              <span className="capitalize">{activeJob.message || status}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatNumber(activeJob.elapsed_s, 1)}s</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>
                Epoch {latestEpoch?.epoch || 0} / {activeJob.total_epochs}
              </span>
              <span className="text-cyan-300 font-bold">
                {formatPercent(activeJob.progress)}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 transition-all duration-200"
                style={{ width: `${Math.min(100, activeJob.progress * 100)}%` }}
              />
            </div>
          </div>

          {/* Live Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white/5 p-2 rounded-xl border border-white/5">
            <div>
              <div className="text-[10px] text-slate-400">Training Loss / Acc</div>
              <div className="text-slate-100 font-bold">
                {formatNumber(latestEpoch?.train_loss, 3)} /{' '}
                <span className="text-cyan-400">{formatPercent(latestEpoch?.train_accuracy)}</span>
              </div>
            </div>
            <div className="border-l border-white/5 pl-2">
              <div className="text-[10px] text-slate-400">Validation Loss / Acc</div>
              <div className="text-slate-100 font-bold">
                {formatNumber(latestEpoch?.val_loss, 3)} /{' '}
                <span className="text-purple-400">{formatPercent(latestEpoch?.val_accuracy)}</span>
              </div>
            </div>
          </div>

          {/* Device and batch detail */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5">
            <div className="flex items-center gap-1 text-emerald-400">
              <Zap className="w-3 h-3" />
              <span>{activeJob.device_name || activeJob.device || 'CPU'}</span>
            </div>
            {activeJob.batch && (
              <div>
                Batch {activeJob.batch.batch}/{activeJob.batch.total_batches}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
