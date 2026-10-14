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
  } = useLabStore()

  const summary = dataset?.summary
  const totalImages = summary?.total_images || 0
  const numClasses = summary?.num_classes || 0
  const canTrain = numClasses >= 2 && totalImages >= 4 && !isTraining

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
            className="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition animate-pulse"
          >
            <StopCircle className="w-4 h-4" />
            <span>Dừng huấn luyện (Cancel)</span>
          </button>
        ) : (
          <button
            onClick={() => startTraining()}
            disabled={!canTrain}
            className={`w-full py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xl ${
              canTrain
                ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:to-purple-500 text-slate-950 shadow-cyan-500/25 scale-[1.01] hover:scale-[1.02]'
                : 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/5'
            }`}
          >
            <Flame className={`w-4 h-4 ${canTrain ? 'text-amber-300 animate-bounce' : 'text-slate-500'}`} />
            <span>
              {numClasses < 2
                ? 'Cần ít nhất 2 lớp để huấn luyện'
                : totalImages < 4
                ? 'Cần thêm ảnh để huấn luyện'
                : 'Bắt đầu huấn luyện mô hình (Train Model)'}
            </span>
          </button>
        )}
      </div>

      {/* Error Message */}
      {errorBanner && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorBanner}</span>
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
