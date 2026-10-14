import React from 'react'
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  Image as ImageIcon,
  Target,
  XCircle,
} from 'lucide-react'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'
import { formatNumber, formatPercent } from '@/lib/utils'
import { ConfusionMatrixChart } from './ConfusionMatrixChart'

export const ModelEvaluationView: React.FC = () => {
  const { activeExperiment, setSelectedLessonKey, theme } = useLabStore()

  const evaluation = activeExperiment?.evaluation?.validation

  if (!activeExperiment || !evaluation) {
    return (
      <div className={`h-64 flex flex-col items-center justify-center text-xs gap-2 ${
        theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-500'
      }`}>
        <span>Chưa có báo cáo đánh giá. Hãy hoàn thành một đợt huấn luyện để xem kết quả kiểm định mô hình.</span>
      </div>
    )
  }

  const {
    accuracy,
    precision_macro,
    recall_macro,
    f1_macro,
    per_class,
    confusion_matrix,
    labels,
    misclassified,
    warnings,
    num_samples,
  } = evaluation

  return (
    <div className="space-y-4 p-2 text-xs">
      {/* Small Dataset or Stability Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 shadow-sm ${
                theme === 'light'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`} />
              <div className="flex-1 flex items-center justify-between">
                <span className={theme === 'light' ? 'text-amber-900 font-medium' : ''}>{w}</span>
                <button
                  onClick={() => setSelectedLessonKey('dataset')}
                  className={`font-mono underline text-[10px] font-semibold ${
                    theme === 'light' ? 'text-amber-800 hover:text-amber-950' : 'text-cyan-300'
                  }`}
                >
                  Tìm hiểu
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className={`p-3 rounded-xl border font-mono shadow-sm ${
          theme === 'light' ? 'bg-sky-50 border-sky-300' : 'bg-cyan-500/10 border-cyan-500/30'
        }`}>
          <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>Độ chính xác (Accuracy)</div>
          <div className={`text-xl font-bold mt-0.5 ${theme === 'light' ? 'text-sky-800' : 'text-cyan-300'}`}>
            {formatPercent(accuracy)}
          </div>
          <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Trên {num_samples} mẫu test/val</div>
        </div>

        <div className={`p-3 rounded-xl border font-mono shadow-sm ${
          theme === 'light' ? 'bg-purple-50 border-purple-300' : 'bg-purple-500/10 border-purple-500/30'
        }`}>
          <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>Precision Macro</div>
          <div className={`text-xl font-bold mt-0.5 ${theme === 'light' ? 'text-purple-800' : 'text-purple-300'}`}>
            {formatPercent(precision_macro)}
          </div>
          <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Độ chuẩn xác trung bình</div>
        </div>

        <div className={`p-3 rounded-xl border font-mono shadow-sm ${
          theme === 'light' ? 'bg-blue-50 border-blue-300' : 'bg-blue-500/10 border-blue-500/30'
        }`}>
          <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>Recall Macro</div>
          <div className={`text-xl font-bold mt-0.5 ${theme === 'light' ? 'text-blue-800' : 'text-blue-300'}`}>
            {formatPercent(recall_macro)}
          </div>
          <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Độ thu hồi trung bình</div>
        </div>

        <div className={`p-3 rounded-xl border font-mono shadow-sm ${
          theme === 'light' ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-500/10 border-emerald-500/30'
        }`}>
          <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>F1-Score Macro</div>
          <div className={`text-xl font-bold mt-0.5 ${theme === 'light' ? 'text-emerald-800' : 'text-emerald-300'}`}>
            {formatPercent(f1_macro)}
          </div>
          <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Trung hòa Precision-Recall</div>
        </div>
      </div>

      {/* Confusion Matrix and Per-class Table Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Confusion Matrix (5 cols) */}
        <div className={`col-span-5 rounded-2xl border p-4 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0c1019] border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>Ma trận Nhầm lẫn</span>
            <button
              onClick={() => setSelectedLessonKey('confusion')}
              className={`text-[10px] font-mono underline font-semibold flex items-center gap-1 ${
                theme === 'light' ? 'text-purple-700 hover:text-purple-900' : 'text-purple-300 hover:text-purple-200'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>Học về Ma trận</span>
            </button>
          </div>
          <ConfusionMatrixChart matrix={confusion_matrix} labels={labels} />
        </div>

        {/* Per-class Metrics Table (7 cols) */}
        <div className={`col-span-7 rounded-2xl border p-4 space-y-2 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0c1019] border-white/10'
        }`}>
          <div className={`font-semibold mb-2 ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
            Hiệu năng chi tiết từng Lớp (Per-Class Performance)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className={`border-b text-[10px] ${
                  theme === 'light' ? 'border-slate-200 text-slate-600 font-bold' : 'border-white/10 text-slate-400'
                }`}>
                  <th className="pb-2">Lớp (Class)</th>
                  <th className="pb-2">Số mẫu (Support)</th>
                  <th className="pb-2">Precision</th>
                  <th className="pb-2">Recall</th>
                  <th className="pb-2">F1-Score</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'light' ? 'divide-slate-200' : 'divide-white/5'}`}>
                {per_class.map((c, idx) => (
                  <tr key={idx} className={theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}>
                    <td className={`py-2.5 font-bold ${theme === 'light' ? 'text-sky-800' : 'text-cyan-300'}`}>{c.label}</td>
                    <td className={`py-2.5 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{c.support}</td>
                    <td className={`py-2.5 font-semibold ${theme === 'light' ? 'text-purple-800' : 'text-purple-300'}`}>{formatPercent(c.precision)}</td>
                    <td className={`py-2.5 font-semibold ${theme === 'light' ? 'text-blue-800' : 'text-blue-300'}`}>{formatPercent(c.recall)}</td>
                    <td className={`py-2.5 font-semibold ${theme === 'light' ? 'text-emerald-800' : 'text-emerald-300'}`}>{formatPercent(c.f1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Misclassified Images Gallery */}
      {misclassified && misclassified.length > 0 && (
        <div className={`rounded-2xl border p-4 space-y-3 ${
          theme === 'light' ? 'bg-white border-rose-300 shadow-sm' : 'bg-[#0c1019] border-rose-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 font-semibold ${theme === 'light' ? 'text-rose-900' : 'text-rose-300'}`}>
              <XCircle className={`w-4 h-4 ${theme === 'light' ? 'text-rose-600' : 'text-rose-400'}`} />
              <span>Các mẫu dự đoán sai tiêu biểu ({misclassified.length} ảnh)</span>
            </div>
            <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-400'}`}>
              Sắp xếp theo độ tự tin sai giảm dần
            </span>
          </div>

          <div className="grid grid-cols-6 gap-2">
            {misclassified.map((item, idx) => (
              <div
                key={idx}
                className={`rounded-xl overflow-hidden p-1.5 space-y-1.5 border ${
                  theme === 'light' ? 'bg-slate-50 border-rose-200' : 'bg-black/60 border-rose-500/30'
                }`}
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-900 relative">
                  <img
                    src={api.getImageUrl(item.image_id, true)}
                    alt="Wrong"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] text-rose-300">
                    {formatPercent(item.confidence)}
                  </div>
                </div>
                <div className="text-[10px] font-mono leading-tight space-y-0.5">
                  <div className={`truncate ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    Thật: <span className={theme === 'light' ? 'text-emerald-700 font-semibold' : 'text-emerald-400'}>{item.true_label}</span>
                  </div>
                  <div className={`truncate ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    Đoán: <span className={theme === 'light' ? 'text-rose-700 font-semibold' : 'text-rose-400'}>{item.predicted_label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
