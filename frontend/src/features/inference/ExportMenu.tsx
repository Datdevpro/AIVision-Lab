import React, { useState } from 'react'
import {
  Code,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Package,
} from 'lucide-react'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'

export const ExportMenu: React.FC = () => {
  const { activeExperiment, capabilities } = useLabStore()
  const [isOpen, setIsOpen] = useState(false)

  if (!activeExperiment) return null

  const expId = activeExperiment.id
  const onnxAvailable = capabilities?.onnx_available

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition"
      >
        <Download className="w-3.5 h-3.5 text-cyan-400" />
        <span>Xuất mô hình (Export)</span>
        <span className="text-[10px] text-slate-400">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-[#0c1019] border border-white/15 p-1.5 shadow-2xl z-50 space-y-1">
          <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
            Tải về tệp mô hình
          </div>

          <a
            href={api.getExportUrl(expId, 'checkpoint')}
            download
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/10 transition"
          >
            <Package className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="font-medium">PyTorch Checkpoint (.pt)</div>
              <div className="text-[10px] text-slate-400">Trọng số mô hình hoàn chỉnh</div>
            </div>
          </a>

          {onnxAvailable && (
            <a
              href={api.getExportUrl(expId, 'onnx')}
              download
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/10 transition"
            >
              <FileCode className="w-4 h-4 text-purple-400" />
              <div>
                <div className="font-medium">ONNX Runtime (.onnx)</div>
                <div className="text-[10px] text-slate-400">Dùng cho C++, Rust, Web, Mobile</div>
              </div>
            </a>
          )}

          <a
            href={api.getExportUrl(expId, 'metadata')}
            download
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/10 transition"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <div>
              <div className="font-medium">Metadata JSON</div>
              <div className="text-[10px] text-slate-400">Cấu hình tiền xử lý & siêu tham số</div>
            </div>
          </a>

          <a
            href={api.getExportUrl(expId, 'labels')}
            download
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/10 transition"
          >
            <Code className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-medium">Nhãn phân loại (labels.json)</div>
              <div className="text-[10px] text-slate-400">Bảng ánh xạ index sang tên class</div>
            </div>
          </a>

          <a
            href={api.getExportUrl(expId, 'metrics_csv')}
            download
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/10 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            <div>
              <div className="font-medium">Chỉ số theo Epoch (CSV)</div>
              <div className="text-[10px] text-slate-400">Dùng để phân tích biểu đồ Excel/Python</div>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}
