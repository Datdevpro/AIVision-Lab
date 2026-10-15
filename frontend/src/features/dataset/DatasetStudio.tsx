import React, { useState } from 'react'
import {
  AlertCircle,
  Database,
  Layers,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'
import { ClassCard } from './ClassCard'
import { DatasetWarningsBanner } from './DatasetWarningsBanner'

export const DatasetStudio: React.FC = () => {
  const {
    currentProject,
    dataset,
    isDatasetLoading,
    loadDataset,
    setErrorBanner,
    hasAttemptedTraining,
    theme,
  } = useLabStore()

  const [isCreatingClass, setIsCreatingClass] = useState(false)

  const classes = dataset?.classes || []
  const summary = dataset?.summary
  const totalImages = summary?.total_images || 0

  const generateNextClassName = () => {
    // Tên lớp mới sẽ có số thứ tự bằng tổng số lớp hiện có + 1, không phụ thuộc vào việc các lớp trước đó đã đổi tên hay chưa
    let nextNum = classes.length + 1
    const existingNames = new Set(classes.map((c) => c.name.trim().toLowerCase()))
    while (existingNames.has(`lớp ${nextNum}`.toLowerCase())) {
      nextNum++
    }
    return `Lớp ${nextNum}`
  }

  const handleAddQuickClass = async () => {
    if (!currentProject || isCreatingClass || classes.length >= 10) return
    setIsCreatingClass(true)
    try {
      const defaultName = generateNextClassName()
      await api.addClass(currentProject.id, defaultName)
      await loadDataset()
    } catch (e: any) {
      setErrorBanner(e.message)
    } finally {
      setIsCreatingClass(false)
    }
  }

  const handleClearAll = async () => {
    if (!currentProject) return
    if (confirm('Bạn có chắc muốn xoá TOÀN BỘ ảnh trong dự án? Thao tác này không thể hoàn tác.')) {
      try {
        await api.clearImages(currentProject.id)
        loadDataset()
      } catch (e: any) {
        setErrorBanner(e.message)
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#07090e]/60 border-r border-white/10 select-none">
      {/* Studio Header */}
      <div className="p-4 border-b border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
              theme === 'light' ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            }`}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className={`font-bold text-xs uppercase tracking-wider flex items-center gap-2 ${
                theme === 'light' ? 'text-slate-900' : 'text-slate-100'
              }`}>
                <span>Dataset Studio</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                  theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-white/5 text-slate-400'
                }`}>
                  {classes.length} Lớp
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => loadDataset()}
              title="Làm mới dữ liệu"
              className={`p-1.5 rounded-lg transition ${
                theme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDatasetLoading ? 'animate-spin text-cyan-500' : ''}`} />
            </button>
            {totalImages > 0 && (
              <button
                onClick={handleClearAll}
                title="Xoá toàn bộ ảnh"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dataset Stats Row */}
        <div className={`grid grid-cols-3 gap-2 text-[11px] font-mono p-2 rounded-xl border ${
          theme === 'light' ? 'bg-slate-100/90 border-slate-200' : 'bg-white/5 border-white/5'
        }`}>
          <div className="text-center">
            <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>Tổng số ảnh</div>
            <div className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>{totalImages}</div>
          </div>
          <div className={`text-center border-x ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
            <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>Tập Train</div>
            <div className={`font-bold ${theme === 'light' ? 'text-sky-700' : 'text-cyan-400'}`}>{summary?.split?.train || 0}</div>
          </div>
          <div className="text-center">
            <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>Validation</div>
            <div className={`font-bold ${theme === 'light' ? 'text-purple-700' : 'text-purple-400'}`}>{summary?.split?.val || 0}</div>
          </div>
        </div>
      </div>

      {/* Classes Scrollable List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quality Warnings: Only show when user has attempted training */}
        {hasAttemptedTraining && summary?.warnings && summary.warnings.length > 0 && (
          <DatasetWarningsBanner warnings={summary.warnings} />
        )}

        {/* Classes Cards */}
        {classes.map((cls) => (
          <ClassCard key={cls.id} classItem={cls} canDelete={classes.length > 2} />
        ))}

        {/* Quick Add Class Button */}
        <button
          onClick={handleAddQuickClass}
          disabled={classes.length >= 10 || isCreatingClass}
          className={`w-full py-3 rounded-2xl border border-dashed transition flex items-center justify-center gap-2 text-xs font-semibold group disabled:opacity-40 disabled:cursor-not-allowed ${
            theme === 'light'
              ? 'border-slate-300 bg-white hover:border-sky-500 hover:bg-sky-50 text-slate-700 hover:text-sky-700 shadow-sm'
              : 'border-white/15 bg-white/[0.02] hover:border-cyan-400/50 hover:bg-cyan-500/5 text-slate-400 hover:text-cyan-300'
          }`}
        >
          {isCreatingClass ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
              <span>Đang tạo khung lớp mới...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 transition group-hover:scale-110" />
              <span>Thêm lớp mới ({classes.length}/10)</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
