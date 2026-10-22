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
import type { EpochMetrics } from '@/types/api'

type TrainingMetricsChartProps = {
  epochs: EpochMetrics[]
  bestEpoch?: number
}

export const TrainingMetricsChart: React.FC<TrainingMetricsChartProps> = ({ epochs, bestEpoch }) => {
  const theme = useLabStore(state => state.theme)

  if (!epochs || epochs.length === 0) {
    return (
      <div className={`h-full min-h-[320px] flex flex-col items-center justify-center px-8 text-center text-xs gap-2 ${
        theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-500'
      }`}>
        <strong>Biểu đồ huấn luyện</strong>
        <span>Chưa có dữ liệu epoch. Bắt đầu huấn luyện hoặc chọn một mô hình đã lưu để xem Loss và Accuracy tại đây.</span>
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
    <div className="grid grid-cols-1 grid-rows-2 gap-3 h-full min-h-[360px]">
      {/* Loss Chart */}
      <div className={`rounded-xl border p-3 flex flex-col min-h-0 min-w-0 ${
        theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0c1019] border-white/10'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs mb-2">
          <span className={`font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
            Hàm mất mát (Loss)
          </span>
          <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-400'}`}>
            Giá trị càng thấp càng tốt
          </span>
        </div>
        <div className="flex-1 w-full min-h-0">
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
                  label={{ value: `Best Ep ${bestEpoch}`, position: 'insideTopLeft', fill: '#059669', fontSize: 10 }}
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
      <div className={`rounded-xl border p-3 flex flex-col min-h-0 min-w-0 ${
        theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0c1019] border-white/10'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs mb-2">
          <span className={`font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
            Độ chính xác (Accuracy)
          </span>
          <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-400'}`}>
            Càng cao càng tốt
          </span>
        </div>
        <div className="flex-1 w-full min-h-0">
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
                  label={{ value: `Best Ep ${bestEpoch}`, position: 'insideTopLeft', fill: '#059669', fontSize: 10 }}
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
