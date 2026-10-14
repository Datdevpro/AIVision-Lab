import React from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useLabStore } from '@/store/useLabStore'

export const TrainingMetricsChart: React.FC = () => {
  const { activeJob, activeExperiment, theme } = useLabStore()

  // Use active job's live epochs if training, or the active experiment's stored epochs
  const epochs = activeJob?.epochs && activeJob.epochs.length > 0
    ? activeJob.epochs
    : activeExperiment?.epoch_metrics || []

  const bestEpoch = activeExperiment?.best_checkpoint?.epoch

  if (!epochs || epochs.length === 0) {
    return (
      <div className={`h-64 flex flex-col items-center justify-center text-xs gap-2 ${
        theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-500'
      }`}>
        <span>Chưa có dữ liệu huấn luyện. Hãy bắt đầu huấn luyện để quan sát các đường cong hàm mất mát (Loss) và độ chính xác (Accuracy).</span>
      </div>
    )
  }

  const tooltipStyle = {
    backgroundColor: theme === 'light' ? '#ffffff' : '#0c1019',
    borderColor: theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    fontSize: '11px',
    color: theme === 'light' ? '#0f172a' : '#f8fafc',
    boxShadow: theme === 'light' ? '0 4px 12px rgba(0,0,0,0.08)' : undefined,
  }

  return (
    <div className="grid grid-cols-2 gap-4 h-full p-2">
      {/* Loss Chart */}
      <div className={`rounded-xl border p-3 flex flex-col ${
        theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0c1019] border-white/10'
      }`}>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className={`font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
            Đường cong Hàm Mất mát (Loss Curve)
          </span>
          <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-400'}`}>
            Giá trị càng thấp càng tốt
          </span>
        </div>
        <div className="flex-1 w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={epochs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.05)'} />
              <XAxis
                dataKey="epoch"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {bestEpoch && (
                <ReferenceLine
                  x={bestEpoch}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: `Best Ep ${bestEpoch}`, fill: '#059669', fontSize: 10 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="train_loss"
                name="Train Loss"
                stroke={theme === 'light' ? '#0284c7' : '#00f0ff'}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="val_loss"
                name="Validation Loss"
                stroke={theme === 'light' ? '#9333ea' : '#a855f7'}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accuracy Chart */}
      <div className={`rounded-xl border p-3 flex flex-col ${
        theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0c1019] border-white/10'
      }`}>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className={`font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
            Độ chính xác (Accuracy Curve)
          </span>
          <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-400'}`}>
            0% → 100% (Càng cao càng tốt)
          </span>
        </div>
        <div className="flex-1 w-full min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={epochs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.05)'} />
              <XAxis
                dataKey="epoch"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickLine={false}
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                formatter={(value: any) => [`${(Number(value) * 100).toFixed(1)}%`]}
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {bestEpoch && (
                <ReferenceLine
                  x={bestEpoch}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: `Best Ep ${bestEpoch}`, fill: '#059669', fontSize: 10 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="train_accuracy"
                name="Train Accuracy"
                stroke={theme === 'light' ? '#0284c7' : '#00f0ff'}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="val_accuracy"
                name="Validation Accuracy"
                stroke={theme === 'light' ? '#16a34a' : '#10b981'}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
