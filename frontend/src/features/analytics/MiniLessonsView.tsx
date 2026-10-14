import React from 'react'
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react'
import { MINI_LESSONS } from '@/data/lessons'
import { useLabStore } from '@/store/useLabStore'

export const MiniLessonsView: React.FC = () => {
  const { setSelectedLessonKey, theme } = useLabStore()
  const lessons = Object.values(MINI_LESSONS)

  return (
    <div className="space-y-4 p-2 text-xs select-none">
      <div className="flex items-center justify-between">
        <div>
          <div className={`font-bold text-sm ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
            Thư viện Khái niệm Thị giác Máy tính & Học Sâu
          </div>
          <div className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            Giải thích trực quan các nguyên lý cốt lõi dành cho học sinh THPT và sinh viên đại học
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            onClick={() => setSelectedLessonKey(lesson.id)}
            className={`p-3.5 rounded-2xl border cursor-pointer transition space-y-2 group ${
              theme === 'light'
                ? 'bg-white border-slate-200 shadow-sm hover:border-sky-400 hover:shadow-md'
                : 'bg-white/[0.03] border-white/5 hover:border-cyan-500/40 hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                theme === 'light' ? 'text-sky-700' : 'text-cyan-400'
              }`}>
                {lesson.title_en}
              </span>
              <ChevronRight className={`w-4 h-4 transition group-hover:translate-x-0.5 ${
                theme === 'light' ? 'text-slate-400 group-hover:text-sky-600' : 'text-slate-500 group-hover:text-cyan-300'
              }`} />
            </div>

            <div className={`font-bold text-sm transition ${
              theme === 'light' ? 'text-slate-900 group-hover:text-sky-700' : 'text-slate-100 group-hover:text-cyan-200'
            }`}>
              {lesson.title_vi}
            </div>

            <p className={`text-xs line-clamp-2 leading-relaxed ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              {lesson.short_summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
