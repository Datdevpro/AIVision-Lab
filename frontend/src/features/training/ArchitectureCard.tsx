import React from 'react'
import { Cpu, HardDrive, Layers, ShieldCheck, Sparkles } from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'
import { formatNumber } from '@/lib/utils'

export const ArchitectureCard: React.FC = () => {
  const { config, paramEstimate, setSelectedLessonKey, theme } = useLabStore()
  const isCustom = config.mode === 'advanced'

  return (
    <div className={`rounded-2xl border p-3.5 space-y-3 transition shadow-sm ${
      theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d1321]/90 border-white/10'
    }`}>
      {/* Title & Backbone Type */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
            theme === 'light' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
          }`}>
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
              theme === 'light' ? 'text-sky-700' : 'text-cyan-400'
            }`}>
              {isCustom ? 'Mạng nơ-ron tuỳ chỉnh' : 'Transfer Learning'}
            </div>
            <div className={`text-xs font-bold flex items-center gap-1.5 ${
              theme === 'light' ? 'text-slate-900' : 'text-slate-100'
            }`}>
              <span>{isCustom ? 'Custom CNN Architecture' : 'MobileNetV3 Small (Pretrained)'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setSelectedLessonKey('transfer_learning')}
          className={`text-[10px] font-mono underline font-semibold ${
            theme === 'light' ? 'text-purple-700 hover:text-purple-900' : 'text-purple-300 hover:text-purple-200'
          }`}
        >
          Học về Transfer
        </button>
      </div>

      {/* Backbone status explanation */}
      <div className={`text-xs p-2.5 rounded-xl border space-y-1 ${
        theme === 'light' ? 'bg-slate-50 text-slate-700 border-slate-200' : 'text-slate-300 bg-white/5 border-white/5'
      }`}>
        {isCustom ? (
          <p className="text-[11px] leading-relaxed">
            Huấn luyện mạng tích chập (CNN) <strong>từ số không</strong> (from scratch) trên ảnh kích thước 64×64.
            Yêu cầu nhiều dữ liệu hơn để đạt độ chính xác cao.
          </p>
        ) : (
          <div className="flex items-start gap-2">
            <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <p className="text-[11px] leading-relaxed">
              Trọng số <strong>ImageNet</strong> được <strong>đóng băng</strong> (frozen). Chỉ huấn luyện phần đầu phân loại mới ({config.dense_layers} lớp ẩn, {config.neurons} neuron).
            </p>
          </div>
        )}
      </div>

      {/* Parameter Count Estimate */}
      {paramEstimate && (
        <div className={`grid grid-cols-3 gap-2 text-center font-mono text-[11px] p-2 rounded-xl border ${
          theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'
        }`}>
          <div>
            <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>
              Tổng tham số
            </div>
            <div className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
              {formatNumber(paramEstimate.total_params, 0)}
            </div>
          </div>
          <div className={theme === 'light' ? 'border-x border-slate-200' : 'border-x border-white/5'}>
            <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>
              Cần huấn luyện
            </div>
            <div className={`font-bold ${theme === 'light' ? 'text-sky-700' : 'text-cyan-400'}`}>
              {formatNumber(paramEstimate.trainable_params, 0)}
            </div>
          </div>
          <div>
            <div className={`text-[10px] ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>
              Đã đóng băng
            </div>
            <div className={`font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
              {formatNumber(paramEstimate.frozen_params, 0)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
