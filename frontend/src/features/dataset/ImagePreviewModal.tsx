import React from 'react'
import { Calendar, Camera, HardDrive, Maximize2, Trash2, X } from 'lucide-react'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'
import type { ImageItem } from '@/types/api'

interface ImagePreviewModalProps {
  image: ImageItem | null
  classNameTitle: string
  onClose: () => void
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  image,
  classNameTitle,
  onClose,
}) => {
  const { loadDataset } = useLabStore()
  if (!image) return null

  const handleDelete = async () => {
    if (confirm('Bạn có chắc muốn xoá ảnh này khỏi tập dữ liệu?')) {
      try {
        await api.deleteImage(image.id)
        loadDataset()
        onClose()
      } catch (e: any) {
        alert(e.message)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#0c1019] border border-white/10 p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div className="text-xs text-cyan-400 font-mono font-semibold uppercase tracking-wider">
              Chi tiết ảnh • {classNameTitle}
            </div>
            <div className="text-sm font-bold text-slate-100 truncate max-w-xs">
              {image.original_name || image.id}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* High-res Image Preview */}
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-black border border-white/10 flex items-center justify-center">
          <img
            src={api.getImageUrl(image.id, false)}
            alt="Preview"
            className="w-full h-full object-contain"
          />
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-[10px] font-mono text-cyan-300 border border-white/10">
            {image.width} × {image.height} px
          </div>
        </div>

        {/* Metadata Details */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-white/5 p-3 rounded-xl border border-white/5 font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gốc: {image.original_width}×{image.original_height}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            <span>Nguồn: {image.source === 'webcam' ? 'Webcam' : 'Tải lên'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>Tập: <strong className="text-white uppercase">{image.subset}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>{new Date(image.created_at).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 font-medium transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xoá ảnh này</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-white font-medium transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
