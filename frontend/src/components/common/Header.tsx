import React, { useState } from 'react'
import {
  BrainCircuit,
  Cpu,
  FolderPlus,
  HelpCircle,
  Layers,
  Moon,
  Sparkles,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'
import type { Mode } from '@/types/api'

export const Header: React.FC = () => {
  const {
    capabilities,
    currentProject,
    projects,
    setCurrentProject,
    createProject,
    deleteProject,
    config,
    setMode,
    setSelectedLessonKey,
    theme,
    toggleTheme,
  } = useLabStore()

  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    await createProject(newProjectName.trim())
    setNewProjectName('')
    setShowNewProject(false)
  }

  const modes: { id: Mode; label: string; icon: string; tag: string }[] = [
    { id: 'beginner', label: 'Khám phá AI', icon: '🌱', tag: 'Beginner' },
    { id: 'intermediate', label: 'Phòng thí nghiệm', icon: '🔬', tag: 'Intermediate' },
    { id: 'advanced', label: 'Network Architect', icon: '⚡', tag: 'Advanced' },
  ]

  const device = capabilities?.device
  const isCuda = device?.type === 'cuda'

  return (
    <header className="h-14 border-b border-white/10 bg-[#07090e]/95 backdrop-blur px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Project Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-bold text-sm tracking-wide bg-clip-text text-transparent ${
                  theme === 'light'
                    ? 'bg-gradient-to-r from-sky-700 via-blue-700 to-purple-800'
                    : 'bg-gradient-to-r from-cyan-300 via-sky-200 to-purple-300'
                }`}
              >
                VISION LAB AI
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                theme === 'light' ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
              }`}>
                v1.0
              </span>
            </div>
            <div className={`text-[10px] font-medium -mt-0.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
              Phòng thí nghiệm Thị giác Máy tính
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <div className="relative">
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
              theme === 'light'
                ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-500" />
            <span className="max-w-[140px] truncate">
              {currentProject ? currentProject.name : 'Chọn dự án...'}
            </span>
            <span className={theme === 'light' ? 'text-slate-600 text-[10px]' : 'text-slate-500 text-[10px]'}>▼</span>
          </button>

          {showProjectDropdown && (
            <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-[#0c1019] border border-white/10 shadow-2xl p-1.5 z-50">
              <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Danh sách dự án
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                      currentProject?.id === p.id
                        ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="truncate flex-1"
                      onClick={() => {
                        setCurrentProject(p)
                        setShowProjectDropdown(false)
                      }}
                    >
                      {p.name}
                    </span>
                    {projects.length > 1 && (
                      <button
                        title="Xoá dự án"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Bạn có chắc muốn xoá dự án "${p.name}"?`)) {
                            deleteProject(p.id)
                          }
                        }}
                        className="p-1 hover:text-rose-400 text-slate-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-white/5 mt-1 pt-1">
                <button
                  onClick={() => {
                    setShowProjectDropdown(false)
                    setShowNewProject(true)
                  }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-cyan-400 hover:bg-cyan-500/10 font-medium transition"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Tạo dự án mới...</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Learning Mode Selector */}
      <div className={`flex items-center p-1 rounded-xl border ${theme === 'light' ? 'bg-slate-100/90 border-slate-200' : 'bg-white/5 border-white/10'}`}>
        {modes.map((m) => {
          const active = config.mode === m.id
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                active
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 scale-[1.02]'
                  : theme === 'light'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
              <span
                className={`text-[9px] px-1 rounded uppercase tracking-wider font-mono ${
                  active
                    ? 'bg-black/20 text-white'
                    : theme === 'light'
                    ? 'bg-slate-200 text-slate-700 border border-slate-300/50 font-semibold'
                    : 'bg-white/5 text-slate-400'
                }`}
              >
                {m.tag}
              </span>
            </button>
          )
        })}
      </div>

      {/* Right Controls: Device, Theme Switch & Help */}
      <div className="flex items-center gap-2.5">
        {/* Device Indicator */}
        <div
          title={
            isCuda
              ? `Tăng tốc phần cứng GPU NVIDIA: ${device?.name} (${device?.vram_gb} GB VRAM)`
              : 'Đang chạy huấn luyện trên CPU'
          }
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono transition ${
            isCuda
              ? theme === 'light'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : theme === 'light'
              ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {isCuda ? <Zap className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> : <Cpu className="w-3.5 h-3.5 text-amber-500" />}
          <span>{isCuda ? (device?.name?.replace('NVIDIA GeForce ', '') || 'CUDA GPU') : 'CPU Mode'}</span>
        </div>

        {/* Theme Mode Switch (Dark / Light) */}
        <button
          type="button"
          role="switch"
          aria-checked={theme === 'light'}
          onClick={toggleTheme}
          title={
            theme === 'dark'
              ? 'Chuyển sang Giao diện Sáng (Light Mode)'
              : 'Chuyển sang Giao diện Tối (Dark Mode)'
          }
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer select-none ${
            theme === 'light'
              ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 shadow-sm'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
          }`}
        >
          <div
            className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
              theme === 'light' ? 'bg-sky-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-white shadow-sm flex items-center justify-center transform transition-transform duration-200">
              {theme === 'light' ? (
                <Sun className="w-2 h-2 text-amber-500" />
              ) : (
                <Moon className="w-2 h-2 text-cyan-600" />
              )}
            </div>
          </div>
          <span className="text-[11px] font-medium hidden sm:inline">
            {theme === 'dark' ? 'Tối' : 'Sáng'}
          </span>
        </button>

        {/* Learning Hub / Help Button */}
        <button
          onClick={() => setSelectedLessonKey('transfer_learning')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            theme === 'light'
              ? 'bg-purple-50 border border-purple-300 text-purple-800 hover:bg-purple-100 font-semibold shadow-sm'
              : 'bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Kiến thức AI</span>
        </button>
      </div>

      {/* Create Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-sm rounded-2xl bg-[#0c1019] border border-white/10 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Tạo Dự án Vision Lab Mới</span>
            </div>
            <p className="text-xs text-slate-400">
              Đặt tên cho dự án phân loại hình ảnh của bạn (ví dụ: "Phân biệt Chó vs Mèo", "Nhận diện Cử chỉ tay").
            </p>
            <input
              type="text"
              autoFocus
              placeholder="Tên dự án..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewProject(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/5"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!newProjectName.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-50 shadow-md shadow-cyan-500/20"
              >
                Tạo Dự án
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  )
}
