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
    theme,
  } = useLabStore()

  const [isAddingClass, setIsAddingClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProject || !newClassName.trim()) return
    try {
      await api.addClass(currentProject.id, newClassName.trim())
      setNewClassName('')
      setIsAddingClass(false)
      loadDataset()
    } catch (e: any) {
      setErrorBanner(e.message)
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

  const classes = dataset?.classes || []
  const summary = dataset?.summary
  const totalImages = summary?.total_images || 0

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
        {/* Quality Warnings */}
        {summary?.warnings && <DatasetWarningsBanner warnings={summary.warnings} />}

        {/* Classes Cards */}
        {classes.map((cls) => (
          <ClassCard key={cls.id} classItem={cls} canDelete={classes.length > 2} />
        ))}

        {/* Add Class Form / Button */}
        {isAddingClass ? (
          <form
            onSubmit={handleAddClass}
            className="rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-3.5 space-y-3 animate-in fade-in"
          >
            <div className="text-xs font-semibold text-cyan-300">Thêm Lớp Phân Loại Mới</div>
            <input
              type="text"
              autoFocus
              placeholder="Tên lớp (ví dụ: Mèo, Chó, Bút)..."
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-medium"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingClass(false)
                  setNewClassName('')
                }}
                className="px-3 py-1 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/5"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!newClassName.trim()}
                className="px-3.5 py-1 rounded-lg text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold disabled:opacity-40 shadow-md shadow-cyan-500/20"
              >
                Lưu lớp
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingClass(true)}
            disabled={classes.length >= 10}
            className="w-full py-3 rounded-2xl border border-dashed border-white/15 hover:border-cyan-400/50 hover:bg-cyan-500/5 text-slate-400 hover:text-cyan-300 text-xs font-medium flex items-center justify-center gap-2 transition group disabled:opacity-30"
          >
            <Plus className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
            <span>Thêm lớp mới ({classes.length}/10)</span>
          </button>
        )}
      </div>
    </div>
  )
}
