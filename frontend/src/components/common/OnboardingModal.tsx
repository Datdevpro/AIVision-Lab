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

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0)
  if (!isOpen) return null

  const steps = [
    {
      step: 1,
      title: 'Bước 1: Tạo các Lớp (Classes)',
      icon: <Layers className="w-5 h-5 text-cyan-400" />,
      desc: 'Tạo ít nhất 2 lớp vật thể bạn muốn phân biệt (ví dụ: "Bút" và "Điện thoại", hoặc "Mèo" và "Chó"). Bạn có thể đổi tên lớp bất kỳ lúc nào.',
    },
    {
      step: 2,
      title: 'Bước 2: Thu thập Hình ảnh',
      icon: <Camera className="w-5 h-5 text-blue-400" />,
      desc: 'Sử dụng webcam tích hợp để chụp ảnh trực tiếp, hoặc kéo thả ảnh tải lên từ máy tính. Nên chụp 20-30 ảnh ở nhiều góc độ và khoảng cách khác nhau.',
    },
    {
      step: 3,
      title: 'Bước 3: Chọn Chế độ & Siêu tham số',
      icon: <Sliders className="w-5 h-5 text-purple-400" />,
      desc: 'Bắt đầu với chế độ "Khám phá AI" (Beginner) để thử nghiệm nhanh với MobileNetV3 được đóng băng, hoặc chuyển sang "Phòng thí nghiệm" để tự điều chỉnh Learning Rate, Optimizer, Dense layers.',
    },
    {
      step: 4,
      title: 'Bước 4: Huấn luyện Mô hình AI',
      icon: <Flame className="w-5 h-5 text-rose-400" />,
      desc: 'Nhấn "Bắt đầu huấn luyện". Động cơ PyTorch trên máy tính của bạn sẽ thực hiện tính toán ma trận thực sự trên CPU hoặc GPU NVIDIA.',
    },
    {
      step: 5,
      title: 'Bước 5: Quan sát Quá trình Học',
      icon: <LineChart className="w-5 h-5 text-emerald-400" />,
      desc: 'Theo dõi biểu đồ Loss và Accuracy thời gian thực qua WebSocket. Tìm hiểu sự khác nhau giữa đường Train và Validation để phát hiện Overfitting.',
    },
    {
      step: 6,
      title: 'Bước 6: Thử nghiệm Trực tiếp (Live Inference)',
      icon: <CheckCircle2 className="w-5 h-5 text-cyan-400" />,
      desc: 'Bật webcam hoặc tải ảnh mới để xem mô hình đưa ra dự đoán cùng phần trăm độ tin cậy. Đánh giá tính chính xác bằng các nút phản hồi Đúng/Sai.',
    },
    {
      step: 7,
      title: 'Bước 7: Cải tiến & So sánh Thử nghiệm',
      icon: <RefreshCw className="w-5 h-5 text-amber-400" />,
      desc: 'Thay đổi một tham số (ví dụ tăng Data Augmentation hoặc giảm Learning Rate), huấn luyện lại và mở tab "So sánh thử nghiệm" để tìm ra mô hình tối ưu nhất!',
    },
  ]

  const active = steps[currentStep]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#0c1019] border border-white/10 p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <span className="p-1.5 rounded-lg bg-cyan-500/20">{active.icon}</span>
            <span>Hướng dẫn 7 Bước Thực hành AI</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
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
                idx === currentStep ? 'w-8 bg-cyan-400' : 'w-2 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-3 py-2">
          <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
            {active.title}
          </div>
          <p className="text-sm text-slate-200 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
            {active.desc}
          </p>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/5 disabled:opacity-30"
          >
            Quay lại
          </button>

          <div className="text-[11px] font-mono text-slate-500">
            {currentStep + 1} / {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20"
            >
              <span>Tiếp tục</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md shadow-emerald-500/25"
            >
              Bắt đầu thực hành ngay!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
