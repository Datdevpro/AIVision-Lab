import React from 'react'
import { useLabStore } from '@/store/useLabStore'

interface ConfusionMatrixChartProps {
  matrix: number[][]
  labels: string[]
}

export const ConfusionMatrixChart: React.FC<ConfusionMatrixChartProps> = ({ matrix, labels }) => {
  const { theme } = useLabStore()
  if (!matrix || matrix.length === 0) return null

  // Find max value in matrix for relative color saturation
  const maxValue = Math.max(...matrix.flatMap((row) => row), 1)

  return (
    <div className="space-y-2 select-none">
      <div className={`text-xs font-semibold flex items-center justify-between ${theme === 'light' ? 'text-slate-800' : 'text-slate-300'}`}>
        <span>Ma trận Nhầm lẫn (Confusion Matrix)</span>
        <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-400'}`}>
          Đường chéo chính = Dự đoán đúng
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs font-mono">
          <thead>
            <tr>
              <th className={`p-2 text-[10px] font-normal ${theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-500'}`}>Thực tế \ Dự đoán</th>
              {labels.map((lbl, idx) => (
                <th key={idx} className={`p-2 text-center font-bold max-w-[80px] truncate ${theme === 'light' ? 'text-sky-800' : 'text-cyan-300'}`}>
                  {lbl}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className={`p-2 font-bold text-right pr-3 max-w-[80px] truncate ${theme === 'light' ? 'text-purple-800' : 'text-purple-300'}`}>
                  {labels[rowIdx]}
                </td>
                {row.map((val, colIdx) => {
                  const isDiagonal = rowIdx === colIdx
                  const intensity = val / maxValue
                  return (
                    <td
                      key={colIdx}
                      className={`p-3 text-center transition hover:scale-105 border ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}
                      style={{
                        backgroundColor: isDiagonal
                          ? theme === 'light'
                            ? `rgba(16, 185, 129, ${Math.max(0.18, intensity * 0.85)})`
                            : `rgba(16, 185, 129, ${Math.max(0.12, intensity * 0.75)})`
                          : val > 0
                          ? theme === 'light'
                            ? `rgba(244, 63, 94, ${Math.max(0.18, intensity * 0.85)})`
                            : `rgba(244, 63, 94, ${Math.max(0.12, intensity * 0.75)})`
                          : theme === 'light'
                          ? 'rgba(0, 0, 0, 0.03)'
                          : 'rgba(255, 255, 255, 0.02)',
                        color: isDiagonal
                          ? theme === 'light' ? '#065f46' : '#6ee7b7'
                          : val > 0
                          ? theme === 'light' ? '#9f1239' : '#fda4af'
                          : theme === 'light' ? '#94a3b8' : '#64748b',
                        fontWeight: val > 0 ? 'bold' : 'normal',
                      }}
                      title={`Thực tế: ${labels[rowIdx]} | Dự đoán: ${labels[colIdx]} | Số mẫu: ${val}`}
                    >
                      {val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
