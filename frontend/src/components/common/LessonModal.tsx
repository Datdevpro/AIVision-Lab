import React from 'react'
import { BookOpen, CheckCircle, Lightbulb, X } from 'lucide-react'
import { MINI_LESSONS } from '@/data/lessons'
import { useLabStore } from '@/store/useLabStore'

export const LessonModal: React.FC = () => {
  const { selectedLessonKey, setSelectedLessonKey, theme } = useLabStore()
  if (!selectedLessonKey) return null

  const lesson = MINI_LESSONS[selectedLessonKey]
  if (!lesson) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 transition-colors ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
            : 'bg-[#0c1019] border-cyan-500/30 text-slate-100 shadow-cyan-950/50'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-start justify-between border-b pb-4 ${
            theme === 'light' ? 'border-slate-200' : 'border-white/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className={`font-bold text-base ${
                    theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  {lesson.title_vi}
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                    theme === 'light'
                      ? 'bg-sky-50 text-sky-700 border-sky-300'
                      : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  }`}
                >
                  {lesson.title_en}
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {lesson.short_summary}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedLessonKey(null)}
            className={`p-1 rounded-lg transition ${
              theme === 'light'
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Detailed Explanation */}
        <div className="space-y-2">
          <div
            className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              theme === 'light' ? 'text-slate-700' : 'text-slate-400'
            }`}
          >
            <span>Bản chất hoạt động</span>
          </div>
          <div
            className={`text-sm leading-relaxed rounded-xl p-4 border transition-colors ${
              theme === 'light'
                ? 'bg-slate-50 text-slate-800 border-slate-200'
                : 'bg-white/5 text-slate-300 border-white/5'
            }`}
          >
            {lesson.detailed_explanation}
          </div>
        </div>

        {/* Practical Lab Tip */}
        <div
          className={`rounded-xl p-4 space-y-1.5 border transition-colors ${
            theme === 'light'
              ? 'bg-amber-50/90 border-amber-300 shadow-sm'
              : 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30'
          }`}
        >
          <div
            className={`flex items-center gap-2 font-bold text-xs ${
              theme === 'light' ? 'text-amber-900' : 'text-amber-300'
            }`}
          >
            <Lightbulb
              className={`w-4 h-4 ${
                theme === 'light' ? 'text-amber-700' : 'text-amber-400'
              }`}
            />
            <span>Mẹo thực hành trong phòng Lab</span>
          </div>
          <p
            className={`text-xs leading-relaxed ${
              theme === 'light' ? 'text-amber-950 font-medium' : 'text-amber-100/90'
            }`}
          >
            {lesson.practical_tip}
          </p>
        </div>

        {/* Key Questions */}
        <div className="space-y-2">
          <div
            className={`text-xs font-bold uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-700' : 'text-slate-400'
            }`}
          >
            Câu hỏi tư duy cho học sinh & sinh viên
          </div>
          <div className="space-y-1.5">
            {lesson.key_questions.map((q, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 text-xs ${
                  theme === 'light' ? 'text-slate-800 font-medium' : 'text-slate-300'
                }`}
              >
                <CheckCircle
                  className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                    theme === 'light' ? 'text-sky-600' : 'text-cyan-400'
                  }`}
                />
                <span>{q}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex justify-end pt-2 border-t ${
            theme === 'light' ? 'border-slate-200' : 'border-white/10'
          }`}
        >
          <button
            onClick={() => setSelectedLessonKey(null)}
            className={`px-4 py-2 rounded-lg font-semibold text-xs transition shadow-md ${
              theme === 'light'
                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/25'
            }`}
          >
            Đã hiểu, tiếp tục thí nghiệm
          </button>
        </div>
      </div>
    </div>
  )
}
