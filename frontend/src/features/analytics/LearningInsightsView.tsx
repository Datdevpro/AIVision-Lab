import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Info,
  Lightbulb,
  Sparkles,
} from 'lucide-react'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'
import type { Insight } from '@/types/api'

export const LearningInsightsView: React.FC = () => {
  const { activeExperiment, activeJob, setSelectedLessonKey } = useLabStore()
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)

  const expId = activeExperiment?.id
  const jobId = activeJob?.id

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true)
      try {
        if (expId) {
          const res = await api.getExperimentInsights(expId)
          setInsights(res.insights || [])
        } else if (jobId) {
          const res = await api.getJobInsights(jobId)
          setInsights(res.insights || [])
        } else {
          setInsights([])
        }
      } catch (e) {
        console.error('Fetch insights error:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [expId, jobId])

  if (!expId && !jobId) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
        <Sparkles className="w-8 h-8 stroke-[1.5]" />
        <span>Chưa có dữ liệu huấn luyện để phân tích nhận xét. Hãy hoàn thành hoặc bắt đầu một đợt train!</span>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-2 text-xs select-none">
      {/* Educational Notice Banner */}
      <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-transparent border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-slate-300">
          <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="font-bold text-slate-100">
              Trợ lý Sư phạm Nhận định Quá trình Học (AI Learning Insights)
            </div>
            <div className="text-[11px] text-slate-400">
              Được tính toán bằng quy tắc giải thuật dựa trên các chỉ số huấn luyện thực tế, không dùng mô hình ngôn ngữ giả lập.
            </div>
          </div>
        </div>
      </div>

      {/* Insights Cards List */}
      <div className="grid grid-cols-2 gap-3">
        {insights.map((ins) => {
          const isWarn = ins.severity === 'warning'
          const isSuccess = ins.severity === 'success'

          return (
            <div
              key={ins.id}
              className={`p-4 rounded-2xl border transition space-y-2 ${
                isWarn
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : isSuccess
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-cyan-500/10 border-cyan-500/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 font-bold text-xs">
                  {isWarn ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : isSuccess ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <span
                    className={
                      isWarn
                        ? 'text-amber-300'
                        : isSuccess
                        ? 'text-emerald-300'
                        : 'text-cyan-300'
                    }
                  >
                    {ins.title}
                  </span>
                </div>

                {ins.lesson && (
                  <button
                    onClick={() => setSelectedLessonKey(ins.lesson || null)}
                    className="flex items-center gap-1 text-[10px] font-mono text-purple-300 hover:text-purple-200 underline"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Bài học</span>
                  </button>
                )}
              </div>

              <p className="text-slate-200 text-xs leading-relaxed opacity-95">
                {ins.message}
              </p>

              {/* Evidence details */}
              {ins.evidence && Object.keys(ins.evidence).length > 0 && (
                <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5 truncate">
                  Số liệu thực: {JSON.stringify(ins.evidence)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
