import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera,
  Check,
  Download,
  Edit2,
  Eraser,
  Image as ImageIcon,
  MoreVertical,
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
  const [showMenu, setShowMenu] = useState(false)
  const [showAllImages, setShowAllImages] = useState(false)
  const [modalAction, setModalAction] = useState<'delete_class' | 'clear_images' | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

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

      {/* Header: Name & 3-Dots Options Menu */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 mr-2 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="text"
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleRename}
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
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleRename}
                className="p-1 text-cyan-500 hover:text-cyan-600"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 group cursor-pointer truncate"
              title="Bấm để đổi tên lớp"
            >
              <h4 className={`font-bold text-sm transition truncate ${
                theme === 'light' ? 'text-slate-900 group-hover:text-sky-600' : 'text-slate-100 group-hover:text-cyan-300'
              }`}>
                {classItem.name}
              </h4>
              <button
                type="button"
                className={`opacity-50 group-hover:opacity-100 p-0.5 transition shrink-0 ${
                  theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
                title="Đổi tên lớp"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Badges & 3-Dots Options Menu */}
        <div className="flex items-center gap-1.5 relative shrink-0" ref={menuRef}>
          <div className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
            theme === 'light'
              ? 'bg-slate-100 border border-slate-200 text-slate-700 font-semibold'
              : 'bg-white/5 border border-white/10 text-slate-300'
          }`}>
            {images.length} ảnh
          </div>

          {/* 3-Dots Button */}
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            title="Tùy chọn lớp"
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              showMenu
                ? theme === 'light' ? 'bg-slate-200 text-sky-600' : 'bg-white/10 text-cyan-400'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Floating Dropdown Menu (Teachable Machine Style) */}
          {showMenu && (
            <div className={`absolute right-0 top-full mt-1.5 w-56 rounded-xl border shadow-2xl p-1 z-40 animate-in fade-in zoom-in-95 duration-150 ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-800 shadow-slate-300/60'
                : 'bg-[#0c1019] border-white/10 text-slate-200 shadow-black/80'
            }`}>
              {/* Option 1: Rename */}
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  setIsEditingName(true)
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/5 text-slate-200'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5 text-sky-500" />
                <span>Đổi tên lớp</span>
              </button>

              {/* Option 2: Remove All Samples */}
              <button
                type="button"
                disabled={images.length === 0}
                onClick={() => {
                  setShowMenu(false)
                  setModalAction('clear_images')
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                  theme === 'light'
                    ? 'hover:bg-amber-50 hover:text-amber-800 text-slate-700'
                    : 'hover:bg-amber-500/10 hover:text-amber-300 text-slate-200'
                }`}
              >
                <Eraser className="w-3.5 h-3.5 text-amber-500" />
                <span>Xoá toàn bộ ảnh ({images.length})</span>
              </button>

              {/* Option 3: Download Samples */}
              <button
                type="button"
                disabled={images.length === 0}
                onClick={() => {
                  setShowMenu(false)
                  window.open(`/api/classes/${classItem.id}/export`, '_blank')
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/5 text-slate-200'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Tải về ảnh mẫu (ZIP)</span>
              </button>

              {/* Divider */}
              <div className={`border-t my-1 ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`} />

              {/* Option 4: Delete Class */}
              <button
                type="button"
                disabled={!canDelete}
                onClick={() => {
                  setShowMenu(false)
                  setModalAction('delete_class')
                }}
                title={!canDelete ? 'Dự án cần duy trì tối thiểu 2 lớp để huấn luyện' : 'Xoá lớp này'}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                  theme === 'light'
                    ? 'hover:bg-rose-50 text-rose-600'
                    : 'hover:bg-rose-500/10 text-rose-400'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Xoá lớp</span>
              </button>
            </div>
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
                ? 'bg-amber-400'
                : images.length > 0
                ? 'bg-cyan-500'
                : 'bg-transparent'
            }`}
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>
      </div>

      {/* Action Buttons: Webcam & Upload */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowWebcam(true)}
          className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
            theme === 'light'
              ? 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-800 shadow-sm'
              : 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Webcam</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
            theme === 'light'
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700 shadow-sm'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Tải tệp lên</span>
        </button>
      </div>

      {/* Image Gallery / Empty State */}
      <div className={`rounded-xl border p-2 min-h-[96px] ${
        theme === 'light' ? 'bg-slate-50/80 border-slate-200' : 'bg-black/30 border-white/5'
      }`}>
        {images.length === 0 ? (
          <div className={`h-20 flex flex-col items-center justify-center text-[11px] text-center px-4 transition ${
            theme === 'light' ? 'text-slate-500' : 'text-slate-500'
          }`}>
            <ImageIcon className="w-5 h-5 mb-1 opacity-50" />
            <span>Chưa có ảnh. Bấm Webcam hoặc kéo thả ảnh vào đây</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-1">
            {(showAllImages ? images : images.slice(0, 8)).map((img) => (
              <div
                key={img.id}
                onClick={() => setPreviewImage(img)}
                className={`aspect-square rounded-lg overflow-hidden border cursor-pointer relative group transition ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 hover:border-sky-400 shadow-xs'
                    : 'bg-slate-900 border-white/10 hover:border-cyan-400'
                }`}
              >
                <img
                  src={api.getImageUrl(img.id, true)}
                  alt={classItem.name}
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

      {images.length > 8 && (
        <button type="button" onClick={() => setShowAllImages(value => !value)}
          className={`w-full text-[11px] font-semibold py-1 ${theme === 'light' ? 'text-sky-700' : 'text-cyan-300'}`}>
          {showAllImages ? 'Thu gọn ảnh' : `Xem thêm ${images.length - 8} ảnh`}
        </button>
      )}

      {/* Clear Images Modal */}
      {modalAction === 'clear_images' && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setModalAction(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
                : 'bg-[#0c1019] border-white/10 text-slate-100 shadow-cyan-950/50'
            }`}
          >
            <div className="flex items-center gap-2.5 text-amber-500 font-bold text-sm">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Eraser className="w-4 h-4 text-amber-500" />
              </div>
              <span>Xoá toàn bộ ảnh trong lớp</span>
            </div>
            <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
              Bạn có chắc muốn xoá toàn bộ <strong className={theme === 'light' ? 'text-slate-950 font-bold' : 'text-white'}>{images.length} ảnh</strong> trong lớp <strong className={theme === 'light' ? 'text-slate-950 font-bold' : 'text-white'}>"{classItem.name}"</strong>? Lớp học sẽ được giữ lại nhưng số lượng ảnh sẽ trở về 0.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalAction(null)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  setModalAction(null)
                  try {
                    await api.clearClassImages(classItem.id)
                    loadDataset()
                  } catch (e: any) {
                    setErrorBanner(e.message)
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Xoá tất cả ảnh</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Class Modal */}
      {modalAction === 'delete_class' && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setModalAction(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
                : 'bg-[#0c1019] border-white/10 text-slate-100 shadow-cyan-950/50'
            }`}
          >
            <div className="flex items-center gap-2.5 text-rose-500 font-bold text-sm">
              <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-rose-500" />
              </div>
              <span>Xác nhận xoá lớp</span>
            </div>
            <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
              Bạn có chắc chắn muốn xoá lớp <strong className={theme === 'light' ? 'text-slate-950 font-bold' : 'text-white'}>"{classItem.name}"</strong> cùng toàn bộ <strong className={theme === 'light' ? 'text-slate-950 font-bold' : 'text-white'}>{images.length} ảnh</strong> bên trong? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalAction(null)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  setModalAction(null)
                  try {
                    await api.deleteClass(classItem.id)
                    loadDataset()
                  } catch (e: any) {
                    setErrorBanner(e.message)
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xoá vĩnh viễn</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
