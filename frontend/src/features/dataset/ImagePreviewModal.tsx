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
  const { loadDataset, theme } = useLabStore()
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
      <div
        className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 transition-colors ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
            : 'bg-[#0c1019] border-white/10 text-slate-100 shadow-cyan-950/40'
        }`}
      >
        <div
          className={`flex items-center justify-between border-b pb-3 ${
            theme === 'light' ? 'border-slate-200' : 'border-white/10'
          }`}
        >
          <div>
            <div
              className={`text-xs font-mono font-bold uppercase tracking-wider ${
                theme === 'light' ? 'text-sky-700' : 'text-cyan-400'
              }`}
            >
              Chi tiết ảnh • {classNameTitle}
            </div>
            <div
              className={`text-sm font-bold truncate max-w-xs ${
                theme === 'light' ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              {image.original_name || image.id}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition ${
              theme === 'light'
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* High-res Image Preview */}
        <div
          className={`relative rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center border ${
            theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black border-white/10'
          }`}
        >
          <img
            src={api.getImageUrl(image.id, false)}
            alt="Preview"
            className="w-full h-full object-contain"
          />
          <div
            className={`absolute top-2 right-2 px-2 py-0.5 rounded backdrop-blur text-[10px] font-mono border shadow-sm ${
              theme === 'light'
                ? 'bg-white/90 text-sky-800 border-slate-200'
                : 'bg-black/60 text-cyan-300 border-white/10'
            }`}
          >
            {image.width} × {image.height} px
          </div>
        </div>

        {/* Metadata Details */}
        <div
          className={`grid grid-cols-2 gap-2 text-xs p-3 rounded-xl border font-mono transition-colors ${
            theme === 'light'
              ? 'bg-slate-50 border-slate-200 text-slate-700'
              : 'bg-white/5 border-white/5 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Maximize2 className="w-3.5 h-3.5 text-cyan-600" />
            <span>Gốc: {image.original_width}×{image.original_height}</span>
          </div>
          <div className="flex items-center gap-2">
            <Camera className="w-3.5 h-3.5 text-purple-600" />
            <span>Nguồn: {image.source === 'sample' ? 'Dataset mẫu' : image.source === 'webcam' ? 'Webcam' : 'Tải lên'}</span>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Tập:{' '}
              <strong className={theme === 'light' ? 'text-slate-900 uppercase' : 'text-white uppercase'}>
                {image.subset}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>{new Date(image.created_at).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div
          className={`flex items-center justify-between pt-2 border-t ${
            theme === 'light' ? 'border-slate-200' : 'border-white/10'
          }`}
        >
          <button
            onClick={handleDelete}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              theme === 'light'
                ? 'text-rose-700 hover:bg-rose-50 border border-rose-200'
                : 'text-rose-400 hover:bg-rose-500/10'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xoá ảnh này</span>
          </button>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              theme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
