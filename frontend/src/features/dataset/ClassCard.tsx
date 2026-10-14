import React, { useRef, useState } from 'react'
import {
  Camera,
  Check,
  Edit2,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'
import type { ClassItem, ImageItem } from '@/types/api'
import { ImagePreviewModal } from './ImagePreviewModal'
import { WebcamCaptureModal } from './WebcamCaptureModal'

interface ClassCardProps {
  classItem: ClassItem
  canDelete: boolean
}

export const ClassCard: React.FC<ClassCardProps> = ({ classItem, canDelete }) => {
  const { currentProject, loadDataset, setErrorBanner, theme } = useLabStore()
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(classItem.name)
  const [showWebcam, setShowWebcam] = useState(false)
  const [previewImage, setPreviewImage] = useState<ImageItem | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleRename = async () => {
    if (!nameInput.trim() || nameInput.trim() === classItem.name) {
      setIsEditingName(false)
      setNameInput(classItem.name)
      return
    }
    try {
      await api.renameClass(classItem.id, nameInput.trim())
      setIsEditingName(false)
      loadDataset()
    } catch (e: any) {
      setErrorBanner(e.message)
      setNameInput(classItem.name)
    }
  }

  const handleDeleteClass = async () => {
    if (confirm(`Bạn có chắc muốn xoá lớp "${classItem.name}" và toàn bộ ảnh bên trong?`)) {
      try {
        await api.deleteClass(classItem.id)
        loadDataset()
      } catch (e: any) {
        setErrorBanner(e.message)
      }
    }
  }

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!currentProject || files.length === 0) return
    const fileList = Array.from(files)
    try {
      const res = await api.uploadImages(currentProject.id, classItem.id, fileList)
      if (res.rejected > 0) {
        const firstErr = res.results.find((r) => r.status === 'rejected')
        setErrorBanner(`Tải lên: ${res.accepted} ảnh thành công, ${res.rejected} ảnh bị từ chối (${firstErr?.message || 'Lỗi định dạng'}).`)
      }
      loadDataset()
    } catch (e: any) {
      setErrorBanner(e.message)
    }
  }

  const images = classItem.images || []
  const targetSamples = 20
  const progressRatio = Math.min(1, images.length / targetSamples)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files) {
          handleUploadFiles(e.dataTransfer.files)
        }
      }}
      className={`rounded-2xl border transition-all ${
        isDragging
          ? 'bg-cyan-500/10 border-cyan-400 shadow-lg shadow-cyan-500/20'
          : theme === 'light'
          ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300 hover:shadow'
          : 'bg-[#0d1321]/90 border-white/10 hover:border-white/15'
      } p-3.5 space-y-3 relative`}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          if (e.target.files) handleUploadFiles(e.target.files)
          e.target.value = ''
        }}
        className="hidden"
      />

      {/* Header: Name & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 mr-2">
          {isEditingName ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="text"
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') {
                    setIsEditingName(false)
                    setNameInput(classItem.name)
                  }
                }}
                className={`w-full px-2 py-0.5 rounded text-xs font-bold focus:outline-none ${
                  theme === 'light'
                    ? 'bg-white border border-sky-500 text-slate-900'
                    : 'bg-black/60 border border-cyan-400 text-white'
                }`}
              />
              <button onClick={handleRename} className="p-1 text-cyan-500 hover:text-cyan-600">
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <h4 className={`font-bold text-sm transition ${
                theme === 'light' ? 'text-slate-900 group-hover:text-sky-600' : 'text-slate-100 group-hover:text-cyan-300'
              }`}>
                {classItem.name}
              </h4>
              <button
                onClick={() => setIsEditingName(true)}
                className={`opacity-0 group-hover:opacity-100 p-0.5 transition ${
                  theme === 'light' ? 'text-slate-400 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                }`}
                title="Đổi tên lớp"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Badges & Delete */}
        <div className="flex items-center gap-2">
          <div className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
            theme === 'light'
              ? 'bg-slate-100 border border-slate-200 text-slate-700 font-semibold'
              : 'bg-white/5 border border-white/10 text-slate-300'
          }`}>
            {images.length} ảnh
          </div>
          {canDelete && (
            <button
              onClick={handleDeleteClass}
              title="Xoá lớp này"
              className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sample Health Bar */}
      <div className="space-y-1">
        <div className={`flex items-center justify-between text-[10px] ${
          theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'
        }`}>
          <span>Tiến độ mẫu khuyến nghị</span>
          <span className="font-mono">{images.length}/{targetSamples}</span>
        </div>
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${
          theme === 'light' ? 'bg-slate-200' : 'bg-white/5'
        }`}>
          <div
            className={`h-full transition-all duration-300 ${
              images.length >= targetSamples
                ? 'bg-emerald-500'
                : images.length >= 10
                ? 'bg-cyan-500'
                : 'bg-amber-500'
            }`}
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>
      </div>

      {/* Action Buttons: Webcam & Upload */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => setShowWebcam(true)}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition ${
            theme === 'light'
              ? 'bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-700 shadow-sm'
              : 'bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-medium'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Webcam</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition ${
            theme === 'light'
              ? 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 shadow-sm'
              : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-medium'
          }`}
        >
          <Upload className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`} />
          <span>Tải tệp lên</span>
        </button>
      </div>

      {/* Image Thumbnails Grid */}
      <div className={`min-h-[90px] max-h-48 overflow-y-auto rounded-xl p-2 border ${
        theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'
      }`}>
        {images.length === 0 ? (
          <div className={`h-20 flex flex-col items-center justify-center text-center text-xs gap-1 ${
            theme === 'light' ? 'text-slate-500 font-medium' : 'text-slate-500'
          }`}>
            <ImageIcon className="w-5 h-5 stroke-[1.5]" />
            <span>Chưa có ảnh. Bấm Webcam hoặc kéo thả ảnh vào đây</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => setPreviewImage(img)}
                className={`group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition border ${
                  theme === 'light'
                    ? 'bg-slate-100 border-slate-200 hover:border-sky-500'
                    : 'bg-slate-900 border-white/10 hover:border-cyan-400'
                }`}
              >
                <img
                  src={api.getImageUrl(img.id, true)}
                  alt="Thumb"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                />
                {img.subset === 'val' && (
                  <div className="absolute top-1 left-1 px-1 rounded bg-purple-600/90 text-white text-[8px] font-mono font-bold">
                    VAL
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="text-[10px] text-cyan-200 font-mono">Xem</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webcam Modal */}
      {showWebcam && (
        <WebcamCaptureModal
          isOpen={showWebcam}
          onClose={() => setShowWebcam(false)}
          classId={classItem.id}
          classNameTitle={classItem.name}
        />
      )}

      {/* High-res Image Modal */}
      {previewImage && (
        <ImagePreviewModal
          image={previewImage}
          classNameTitle={classItem.name}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  )
}
