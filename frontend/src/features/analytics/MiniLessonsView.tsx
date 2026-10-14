import React from 'react'
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react'
import { MINI_LESSONS } from '@/data/lessons'
import { useLabStore } from '@/store/useLabStore'

export const MiniLessonsView: React.FC = () => {
  const { setSelectedLessonKey } = useLabStore()
  const lessons = Object.values(MINI_LESSONS)

  return (
    <div className="space-y-4 p-2 text-xs select-none">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-slate-100 text-sm">
            Thư viện Khái niệm Thị giác Máy tính & Học Sâu
          </div>
          <div className="text-slate-400 text-xs">
            Giải thích trực quan các nguyên lý cốt lõi dành cho học sinh THPT và sinh viên đại học
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            onClick={() => setSelectedLessonKey(lesson.id)}
            className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/40 hover:bg-white/[0.06] cursor-pointer transition space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                {lesson.title_en}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 transition group-hover:translate-x-0.5" />
            </div>

            <div className="font-bold text-sm text-slate-100 group-hover:text-cyan-200 transition">
              {lesson.title_vi}
            </div>

            <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
              {lesson.short_summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
