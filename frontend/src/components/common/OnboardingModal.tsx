import React, { useState } from 'react'
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Flame,
  Layers,
  LineChart,
  RefreshCw,
  Sliders,
  X,
} from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const { theme } = useLabStore()
  if (!isOpen) return null

  const steps = [
    {
      step: 1,
      title: 'Bước 1: Tạo các Lớp (Classes)',
      icon: <Layers className="w-5 h-5 text-cyan-500" />,
      desc: 'Tạo ít nhất 2 lớp vật thể bạn muốn phân biệt (ví dụ: "Bút" và "Điện thoại", hoặc "Mèo" và "Chó"). Bạn có thể đổi tên lớp bất kỳ lúc nào.',
    },
    {
      step: 2,
      title: 'Bước 2: Thu thập Hình ảnh',
      icon: <Camera className="w-5 h-5 text-blue-500" />,
      desc: 'Sử dụng webcam tích hợp để chụp ảnh trực tiếp, hoặc kéo thả ảnh tải lên từ máy tính. Nên chụp 20-30 ảnh ở nhiều góc độ và khoảng cách khác nhau.',
    },
    {
      step: 3,
      title: 'Bước 3: Chọn Chế độ & Siêu tham số',
      icon: <Sliders className="w-5 h-5 text-purple-500" />,
      desc: 'Bắt đầu với chế độ "Khám phá AI" (Beginner) để thử nghiệm nhanh với MobileNetV3 được đóng băng, hoặc chuyển sang "Phòng thí nghiệm" để tự điều chỉnh Learning Rate, Optimizer, Dense layers.',
    },
    {
      step: 4,
      title: 'Bước 4: Huấn luyện Mô hình AI',
      icon: <Flame className="w-5 h-5 text-rose-500" />,
      desc: 'Nhấn "Bắt đầu huấn luyện". Động cơ PyTorch trên máy tính của bạn sẽ thực hiện tính toán ma trận thực sự trên CPU hoặc GPU NVIDIA.',
    },
    {
      step: 5,
      title: 'Bước 5: Quan sát Quá trình Học',
      icon: <LineChart className="w-5 h-5 text-emerald-500" />,
      desc: 'Theo dõi biểu đồ Loss và Accuracy thời gian thực qua WebSocket. Tìm hiểu sự khác nhau giữa đường Train và Validation để phát hiện Overfitting.',
    },
    {
      step: 6,
      title: 'Bước 6: Thử nghiệm Trực tiếp (Live Inference)',
      icon: <CheckCircle2 className="w-5 h-5 text-cyan-500" />,
      desc: 'Bật webcam hoặc tải ảnh mới để xem mô hình đưa ra dự đoán cùng phần trăm độ tin cậy. Đánh giá tính chính xác bằng các nút phản hồi Đúng/Sai.',
    },
    {
      step: 7,
      title: 'Bước 7: Cải tiến & So sánh Thử nghiệm',
      icon: <RefreshCw className="w-5 h-5 text-amber-500" />,
      desc: 'Thay đổi một tham số (ví dụ tăng Data Augmentation hoặc giảm Learning Rate), huấn luyện lại và mở tab "So sánh thử nghiệm" để tìm ra mô hình tối ưu nhất!',
    },
  ]

  const active = steps[currentStep]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 transition-colors ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
            : 'bg-[#0c1019] border-white/10 text-slate-100 shadow-cyan-950/40'
        }`}
      >
        <div
          className={`flex items-center justify-between border-b pb-4 ${
            theme === 'light' ? 'border-slate-200' : 'border-white/10'
          }`}
        >
          <div
            className={`flex items-center gap-2 font-bold text-base ${
              theme === 'light' ? 'text-sky-700' : 'text-cyan-400'
            }`}
          >
            <span
              className={`p-1.5 rounded-lg ${
                theme === 'light' ? 'bg-sky-50 border border-sky-200' : 'bg-cyan-500/20'
              }`}
            >
              {active.icon}
            </span>
            <span>Hướng dẫn 7 Bước Thực hành AI</span>
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

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5">
          {steps.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentStep
                  ? theme === 'light'
                    ? 'w-8 bg-sky-600'
                    : 'w-8 bg-cyan-400'
                  : theme === 'light'
                  ? 'w-2 bg-slate-300 hover:bg-slate-400'
                  : 'w-2 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-3 py-2">
          <div
            className={`text-xs font-mono uppercase tracking-wider font-bold ${
              theme === 'light' ? 'text-sky-700' : 'text-cyan-400'
            }`}
          >
            {active.title}
          </div>
          <p
            className={`text-sm leading-relaxed p-4 rounded-xl border transition-colors ${
              theme === 'light'
                ? 'bg-slate-50 text-slate-800 border-slate-200'
                : 'bg-white/5 text-slate-200 border-white/5'
            }`}
          >
            {active.desc}
          </p>
        </div>

        {/* Footer controls */}
        <div
          className={`flex items-center justify-between pt-2 border-t ${
            theme === 'light' ? 'border-slate-200' : 'border-white/10'
          }`}
        >
          <button
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-30 ${
              theme === 'light'
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            Quay lại
          </button>

          <div
            className={`text-[11px] font-mono font-semibold ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-500'
            }`}
          >
            {currentStep + 1} / {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-md transition ${
                theme === 'light'
                  ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/20'
              }`}
            >
              <span>Tiếp tục</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold shadow-md transition ${
                theme === 'light'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
              }`}
            >
              Bắt đầu thực hành ngay!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
