import React from 'react'
import { AlertCircle, AlertTriangle, BookOpen, Info } from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'
import type { DatasetWarning } from '@/types/api'

interface WarningsBannerProps {
  warnings: DatasetWarning[]
}

export const DatasetWarningsBanner: React.FC<WarningsBannerProps> = ({ warnings }) => {
  const { setSelectedLessonKey, theme } = useLabStore()
  if (!warnings || warnings.length === 0) return null

  return (
    <div className="space-y-1.5 mb-3">
      {warnings.map((w, idx) => {
        const isError = w.severity === 'error'
        const isWarn = w.severity === 'warning'
        return (
          <div
            key={idx}
            className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition shadow-sm ${
              isError
                ? theme === 'light'
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                : isWarn
                ? theme === 'light'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : theme === 'light'
                ? 'bg-sky-50/90 border-sky-300 text-sky-950'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isError ? (
                <AlertCircle className={`w-4 h-4 ${theme === 'light' ? 'text-rose-600' : 'text-rose-400'}`} />
              ) : isWarn ? (
                <AlertTriangle className={`w-4 h-4 ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`} />
              ) : (
                <Info className={`w-4 h-4 ${theme === 'light' ? 'text-sky-600' : 'text-cyan-400'}`} />
              )}
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="font-semibold text-xs flex items-center justify-between">
                <span className={theme === 'light' ? (isError ? 'text-rose-900 font-bold' : isWarn ? 'text-amber-900 font-bold' : 'text-sky-900 font-bold') : ''}>
                  {w.title}
                </span>
                {w.lesson && (
                  <button
                    onClick={() => setSelectedLessonKey(w.lesson || null)}
                    className={`flex items-center gap-1 text-[10px] font-mono underline font-semibold ${
                      theme === 'light'
                        ? isError
                          ? 'text-rose-700 hover:text-rose-900'
                          : isWarn
                          ? 'text-amber-800 hover:text-amber-950'
                          : 'text-sky-700 hover:text-sky-900'
                        : 'text-cyan-300 hover:text-cyan-200'
                    }`}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Bài học AI</span>
                  </button>
                )}
              </div>
              <p className={`text-[11px] leading-relaxed ${
                theme === 'light'
                  ? isError ? 'text-rose-900/90 font-medium' : isWarn ? 'text-amber-900/90 font-medium' : 'text-sky-900/90 font-medium'
                  : 'opacity-90'
              }`}>
                {w.message}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
