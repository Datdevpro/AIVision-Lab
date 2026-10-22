import React, { useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  GitCompare,
  Layers,
  Lightbulb,
  Target,
} from 'lucide-react'
import { useLabStore, type BottomTab } from '@/store/useLabStore'
import { ExperimentComparisonView } from './ExperimentComparisonView'
import { LearningInsightsView } from './LearningInsightsView'
import { MiniLessonsView } from './MiniLessonsView'
import { ModelEvaluationView } from './ModelEvaluationView'
import { NetworkVisualizer } from '../neural-visualizer/NetworkVisualizer'

export const AnalyticsWorkspace: React.FC = () => {
  const { activeBottomTab, setActiveBottomTab, theme, activeJob } = useLabStore()
  const [collapseState, setCollapseState] = useState({ jobId: null as string | null, collapsed: true })
  // Open a new training session once; users can still collapse it afterwards.
  const isCollapsed = activeJob && collapseState.jobId !== activeJob.id ? false : collapseState.collapsed
  const setIsCollapsed = (collapsed: boolean) => setCollapseState({ jobId: activeJob?.id ?? null, collapsed })

  const tabs: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
    { id: 'architecture', label: 'Mạng Nơ-ron & Biểu đồ', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'evaluation', label: 'Đánh giá & Confusion Matrix', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'experiments', label: 'So sánh Thử nghiệm', icon: <GitCompare className="w-3.5 h-3.5" /> },
    { id: 'insights', label: 'Nhận định Sư phạm AI', icon: <Lightbulb className="w-3.5 h-3.5" /> },
    { id: 'lessons', label: 'Khái niệm & Bài học', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ]

  return (
    <div
      role="region"
      aria-label="Phân tích mô hình"
      className={`border-t shrink-0 flex flex-col transition-all duration-300 select-none ${
        theme === 'light' ? 'border-slate-200 bg-white/95 text-slate-900 shadow-sm' : 'border-white/10 bg-[#07090e]/95 backdrop-blur'
      } ${isCollapsed ? 'h-11' : 'h-[min(680px,82vh)]'}`}
    >
      {/* Tab Header Bar */}
      <div className={`h-11 px-4 border-b flex items-center justify-between shrink-0 ${
        theme === 'light' ? 'border-slate-200' : 'border-white/10'
      }`}>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeBottomTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveBottomTab(tab.id)
                  setIsCollapsed(false)
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  active && !isCollapsed
                    ? theme === 'light'
                      ? 'bg-sky-50 border border-sky-300 text-sky-700 shadow-sm font-bold'
                      : 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : theme === 'light'
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Collapse / Expand Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1 rounded-lg transition text-xs flex items-center gap-1 ${
            theme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title={isCollapsed ? 'Mở rộng bảng phân tích' : 'Thu gọn'}
        >
          <span className="text-[11px] font-mono">{isCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
          {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Tab Content Body */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {activeBottomTab === 'architecture' && <NetworkVisualizer key={activeJob?.id ?? 'draft'} />}
          {activeBottomTab === 'evaluation' && <ModelEvaluationView />}
          {activeBottomTab === 'experiments' && <ExperimentComparisonView />}
          {activeBottomTab === 'insights' && <LearningInsightsView />}
          {activeBottomTab === 'lessons' && <MiniLessonsView />}
        </div>
      )}
    </div>
  )
}
