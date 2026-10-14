import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  GitCompare,
  Layers,
  LineChart as LineChartIcon,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'
import { formatNumber, formatPercent } from '@/lib/utils'
import type { CompareResult } from '@/types/api'

export const ExperimentComparisonView: React.FC = () => {
  const { experiments, theme } = useLabStore()

  const [expAId, setExpAId] = useState<string>('')
  const [expBId, setExpBId] = useState<string>('')
  const [compareData, setCompareData] = useState<CompareResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Auto-select latest 2 experiments if available
  useEffect(() => {
    if (experiments.length >= 2) {
      if (!expAId) setExpAId(experiments[0].id)
      if (!expBId) setExpBId(experiments[1].id)
    } else if (experiments.length === 1) {
      if (!expAId) setExpAId(experiments[0].id)
    }
  }, [experiments])

  useEffect(() => {
    if (!expAId || !expBId || expAId === expBId) {
      setCompareData(null)
      return
    }

    const loadCompare = async () => {
      setIsLoading(true)
      try {
        const res = await api.getCompare(expAId, expBId)
        setCompareData(res)
      } catch (e) {
        console.error('Compare failed:', e)
      } finally {
        setIsLoading(false)
      }
    }
    loadCompare()
  }, [expAId, expBId])

  if (experiments.length < 2) {
    return (
      <div className={`h-64 flex flex-col items-center justify-center text-xs gap-2 ${
        theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-500'
      }`}>
        <GitCompare className="w-8 h-8 stroke-[1.5]" />
        <span>Cần ít nhất 2 thử nghiệm huấn luyện hoàn thành để so sánh. Hãy thay đổi một siêu tham số và huấn luyện lại!</span>
      </div>
    )
  }

  const a = compareData?.a
  const b = compareData?.b

  return (
    <div className="space-y-4 p-2 text-xs">
      {/* Experiment Selectors Bar */}
      <div className={`flex items-center justify-between p-3 rounded-2xl border ${
        theme === 'light' ? 'bg-slate-50 border-slate-200 shadow-sm' : 'bg-white/5 border-white/5'
      }`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`font-bold ${theme === 'light' ? 'text-sky-800' : 'text-cyan-300'}`}>Thử nghiệm A:</span>
            <select
              value={expAId}
              onChange={(e) => setExpAId(e.target.value)}
              className={`rounded-xl px-2.5 py-1 text-xs font-semibold focus:outline-none border ${
                theme === 'light' ? 'bg-white border-sky-300 text-sky-900 shadow-sm' : 'bg-black/60 border-cyan-500/40 text-cyan-300'
              }`}
            >
              {experiments.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.name} (Val: {formatPercent(exp.best_val_accuracy)})
                </option>
              ))}
            </select>
          </div>

          <span className={`font-mono font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-500'}`}>VS</span>

          <div className="flex items-center gap-2">
            <span className={`font-bold ${theme === 'light' ? 'text-purple-800' : 'text-purple-300'}`}>Thử nghiệm B:</span>
            <select
              value={expBId}
              onChange={(e) => setExpBId(e.target.value)}
              className={`rounded-xl px-2.5 py-1 text-xs font-semibold focus:outline-none border ${
                theme === 'light' ? 'bg-white border-purple-300 text-purple-900 shadow-sm' : 'bg-black/60 border-purple-500/40 text-purple-300'
              }`}
            >
              {experiments.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.name} (Val: {formatPercent(exp.best_val_accuracy)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {compareData && (
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className={theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}>Kết luận Validation:</span>
            <span className={`font-bold px-2 py-0.5 rounded-full border ${
              theme === 'light' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}>
              {compareData.best_by_validation === 'a'
                ? `Mô hình A tốt hơn (${a?.name})`
                : compareData.best_by_validation === 'b'
                ? `Mô hình B tốt hơn (${b?.name})`
                : 'Hai mô hình ngang nhau'}
            </span>
          </div>
        )}
      </div>

      {/* Fairness & Dataset Integrity Warnings */}
      {compareData?.warnings && compareData.warnings.length > 0 && (
        <div className="space-y-1.5">
          {compareData.warnings.map((w, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 shadow-sm ${
                theme === 'light' ? 'bg-amber-50/90 border-amber-300 text-amber-950 font-medium' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`} />
              <span className={theme === 'light' ? 'text-amber-900' : ''}>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Side-by-Side KPI Cards */}
      {a && b && (
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 font-mono">
            <div className="text-[10px] text-slate-400">Validation Accuracy</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-bold text-cyan-300">A: {formatPercent(a.best_val_accuracy)}</span>
              <span className="text-sm font-bold text-purple-300">B: {formatPercent(b.best_val_accuracy)}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 font-mono">
            <div className="text-[10px] text-slate-400">Validation Loss (Thấp hơn tốt hơn)</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-bold text-cyan-300">A: {formatNumber(a.best_val_loss, 3)}</span>
              <span className="text-sm font-bold text-purple-300">B: {formatNumber(b.best_val_loss, 3)}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 font-mono">
            <div className="text-[10px] text-slate-400">Thời gian huấn luyện</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-bold text-cyan-300">A: {formatNumber(a.duration_s, 1)}s</span>
              <span className="text-sm font-bold text-purple-300">B: {formatNumber(b.duration_s, 1)}s</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 font-mono">
            <div className="text-[10px] text-slate-400">Tham số huấn luyện</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-bold text-cyan-300">
                A: {formatNumber(a.param_counts?.trainable_params, 0)}
              </span>
              <span className="text-sm font-bold text-purple-300">
                B: {formatNumber(b.param_counts?.trainable_params, 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Parameter Differences Table */}
      {compareData && (
        <div className="rounded-2xl bg-[#0c1019] border border-white/10 p-4 space-y-2">
          <div className="font-semibold text-slate-200">
            Các điểm khác biệt về Siêu tham số ({compareData.config_diff.length} thông số)
          </div>

          {compareData.config_diff.length === 0 ? (
            <div className="text-slate-400 text-xs py-2">
              Hai thử nghiệm có cùng siêu tham số cấu hình.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] text-slate-400">
                    <th className="pb-2">Tham số (Parameter)</th>
                    <th className="pb-2 text-cyan-300">Thử nghiệm A ({a?.name})</th>
                    <th className="pb-2 text-purple-300">Thử nghiệm B ({b?.name})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {compareData.config_diff.map((diff, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="py-2 text-slate-200 font-semibold">{diff.key}</td>
                      <td className="py-2 text-cyan-400">{String(diff.a)}</td>
                      <td className="py-2 text-purple-400">{String(diff.b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
