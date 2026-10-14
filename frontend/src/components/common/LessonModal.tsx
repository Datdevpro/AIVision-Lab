import React from 'react'
import { BookOpen, CheckCircle, Lightbulb, X } from 'lucide-react'
import { MINI_LESSONS } from '@/data/lessons'
import { useLabStore } from '@/store/useLabStore'

export const LessonModal: React.FC = () => {
  const { selectedLessonKey, setSelectedLessonKey } = useLabStore()
  if (!selectedLessonKey) return null

  const lesson = MINI_LESSONS[selectedLessonKey]
  if (!lesson) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-[#0c1019] border border-cyan-500/30 p-6 shadow-2xl shadow-cyan-950/50 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-100">{lesson.title_vi}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {lesson.title_en}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{lesson.short_summary}</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedLessonKey(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Detailed Explanation */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>Bản chất hoạt động</span>
          </div>
          <div className="text-sm text-slate-300 leading-relaxed bg-white/5 rounded-xl p-4 border border-white/5">
            {lesson.detailed_explanation}
          </div>
        </div>

        {/* Practical Lab Tip */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span>Mẹo thực hành trong phòng Lab</span>
          </div>
          <p className="text-xs text-amber-100/90 leading-relaxed">{lesson.practical_tip}</p>
        </div>

        {/* Key Questions */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Câu hỏi tư duy cho học sinh & sinh viên
          </div>
          <div className="space-y-1.5">
            {lesson.key_questions.map((q, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>{q}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            onClick={() => setSelectedLessonKey(null)}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition shadow-lg shadow-cyan-500/25"
          >
            Đã hiểu, tiếp tục thí nghiệm
          </button>
        </div>
      </div>
    </div>
  )
}
