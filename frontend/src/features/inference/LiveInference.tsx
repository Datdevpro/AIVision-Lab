import React, { useEffect, useRef, useState } from 'react'
import {
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Upload,
  Video,
  VideoOff,
  X,
  Zap,
} from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'
import { formatNumber, formatPercent } from '@/lib/utils'
import { ExportMenu } from './ExportMenu'

export const LiveInference: React.FC = () => {
  const {
    activeExperiment,
    experiments,
    loadExperimentDetails,
    predictImage,
    lastPrediction,
    isPredicting,
    feedbackStats,
    submitFeedback,
    theme,
  } = useLabStore()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isLoopRunningRef = useRef(false)

  const [isWebcamRunning, setIsWebcamRunning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [inferenceIntervalMs, setInferenceIntervalMs] = useState(300)
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null)
  const [feedbackSent, setFeedbackSent] = useState(false)

  // Start webcam
  const startCamera = async () => {
    setCameraError(null)
    setUploadedPreview(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setIsWebcamRunning(true)
      isLoopRunningRef.current = true
      runInferenceLoop()
    } catch (e: any) {
      console.error('Camera error:', e)
      setIsWebcamRunning(false)
      setCameraError('Không thể mở Webcam hoặc quyền truy cập bị từ chối.')
    }
  }

  // Stop webcam and release stream
  const stopCamera = () => {
    isLoopRunningRef.current = false
    setIsWebcamRunning(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Throttled inference loop (never overlaps)
  const runInferenceLoop = async () => {
    if (!isLoopRunningRef.current) return
    if (videoRef.current && canvasRef.current && !isPredicting && activeExperiment) {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video.readyState >= 2) {
        canvas.width = 224
        canvas.height = 224
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, 224, 224)
          canvas.toBlob(
            async (blob) => {
              if (blob && isLoopRunningRef.current) {
                await predictImage(blob)
                setFeedbackSent(false)
              }
              if (isLoopRunningRef.current) {
                setTimeout(runInferenceLoop, inferenceIntervalMs)
              }
            },
            'image/jpeg',
            0.8
          )
          return
        }
      }
    }
    if (isLoopRunningRef.current) {
      setTimeout(runInferenceLoop, 200)
    }
  }

  // Handle static file upload for testing
  const handleTestFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    stopCamera()
    const reader = new FileReader()
    reader.onload = (evt) => {
      setUploadedPreview(evt.target?.result as string)
    }
    reader.readAsDataURL(file)
    predictImage(file)
    setFeedbackSent(false)
    e.target.value = ''
  }

  const handleFeedback = (correct: boolean) => {
    submitFeedback(correct)
    setFeedbackSent(true)
  }

  return (
    <div className={`h-full flex flex-col select-none ${theme === 'light' ? 'bg-[#f8fafc]' : 'bg-[#07090e]/80'}`}>
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
            theme === 'light' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className={`font-bold text-xs uppercase tracking-wider flex items-center gap-2 ${
              theme === 'light' ? 'text-slate-900' : 'text-slate-100'
            }`}>
              <span>Thử nghiệm Dự đoán Trực tiếp (Live Inference)</span>
            </h2>
          </div>
        </div>

        {/* Export Dropdown */}
        {activeExperiment && <ExportMenu />}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Experiment Selector */}
        {experiments.length > 0 ? (
          <div className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
            theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
          }`}>
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-500" />
              <span className={theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}>Mô hình đang dùng:</span>
              <select
                value={activeExperiment?.id || ''}
                onChange={(e) => loadExperimentDetails(e.target.value)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none border ${
                  theme === 'light'
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-black/60 border-white/10 text-cyan-300'
                }`}
              >
                {experiments.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.name} (Val Acc: {formatPercent(exp.best_val_accuracy)})
                  </option>
                ))}
              </select>
            </div>

            {activeExperiment && (
              <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-600 font-semibold' : 'text-slate-400'}`}>
                {activeExperiment.architecture} • {activeExperiment.device.toUpperCase()}
              </span>
            )}
          </div>
        ) : (
          <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 shadow-sm ${
            theme === 'light'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}>
            <Sparkles className={`w-5 h-5 shrink-0 ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`} />
            <div>
              <div className={`font-bold ${theme === 'light' ? 'text-amber-950 font-bold' : ''}`}>Chưa có mô hình nào được huấn luyện</div>
              <p className={`text-[11px] mt-0.5 ${theme === 'light' ? 'text-amber-900/90 font-medium' : 'opacity-80'}`}>
                Hãy chuẩn bị ảnh ở cột bên trái và bấm <strong>"Bắt đầu huấn luyện"</strong> ở cột giữa. Mô hình sau khi học xong sẽ tự động kích hoạt tại đây.
              </p>
            </div>
          </div>
        )}

        {/* Viewport: Webcam or Uploaded image */}
        <div
          className={`relative rounded-2xl overflow-hidden aspect-[4/3] border transition-colors flex items-center justify-center ${
            theme === 'light'
              ? 'bg-slate-100/90 border-slate-300/80 shadow-inner shadow-slate-200/50'
              : 'bg-black/90 border-white/10 shadow-inner'
          }`}
        >
          {/* Webcam video element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] bg-black ${isWebcamRunning ? 'block' : 'hidden'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Uploaded image preview */}
          {uploadedPreview && !isWebcamRunning && (
            <img
              src={uploadedPreview}
              alt="Uploaded for testing"
              className="w-full h-full object-contain"
            />
          )}

          {/* Fallback Idle State */}
          {!isWebcamRunning && !uploadedPreview && (
            <div className="text-center p-6 space-y-2.5">
              <div
                className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border transition-colors ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 text-slate-500 shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <Camera className="w-7 h-7 stroke-[1.5]" />
              </div>
              <div
                className={`text-xs font-semibold ${
                  theme === 'light' ? 'text-slate-800' : 'text-slate-300'
                }`}
              >
                Khởi động Webcam hoặc Tải ảnh lên để kiểm tra mô hình
              </div>
              <p
                className={`text-[11px] max-w-xs mx-auto leading-relaxed ${
                  theme === 'light' ? 'text-slate-500 font-medium' : 'text-slate-400'
                }`}
              >
                Bấm nút <strong>"Bật Webcam Live"</strong> hoặc <strong>"Tải ảnh thử"</strong> bên dưới để bắt đầu dự đoán
              </p>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div
              className={`absolute inset-0 flex items-center justify-center p-6 text-center text-xs font-medium ${
                theme === 'light'
                  ? 'bg-white/95 text-rose-700 border border-rose-300'
                  : 'bg-black/80 text-rose-300'
              }`}
            >
              {cameraError}
            </div>
          )}

          {/* Live Overlay Badge */}
          {lastPrediction && (
            <div
              className={`absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono shadow-xl backdrop-blur ${
                theme === 'light'
                  ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/50'
                  : 'bg-black/70 border-white/15 text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
              <span className={theme === 'light' ? 'text-slate-600' : 'text-slate-300'}>Dự đoán:</span>
              <strong className={`text-sm font-bold ${theme === 'light' ? 'text-sky-700' : 'text-cyan-300'}`}>
                {lastPrediction.predicted_label}
              </strong>
              <span className={theme === 'light' ? 'text-slate-500' : 'text-slate-400'}>
                ({formatPercent(lastPrediction.confidence)})
              </span>
            </div>
          )}

          {/* Latency badge */}
          {lastPrediction && (
            <div
              className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono shadow-md backdrop-blur ${
                theme === 'light'
                  ? 'bg-white/95 border-slate-200 text-emerald-700 font-bold'
                  : 'bg-black/60 border-white/10 text-emerald-400'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>{formatNumber(lastPrediction.latency_ms, 1)} ms</span>
            </div>
          )}
        </div>

        {/* Viewport Control Buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isWebcamRunning ? (
              <button
                onClick={stopCamera}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  theme === 'light'
                    ? 'bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 shadow-sm'
                    : 'bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300'
                }`}
              >
                <VideoOff className="w-3.5 h-3.5" />
                <span>Tắt Webcam</span>
              </button>
            ) : (
              <button
                onClick={startCamera}
                disabled={!activeExperiment}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition ${
                  theme === 'light'
                    ? 'bg-sky-600 hover:bg-sky-700 border border-transparent text-white shadow-sm'
                    : 'bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Bật Webcam Live</span>
              </button>
            )}

            <label
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                theme === 'light'
                  ? 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200'
              }`}
            >
              <Upload className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`} />
              <span>Tải ảnh thử</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleTestFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Throttle speed control */}
          <div className={`flex items-center gap-1.5 text-[10px] font-mono ${
            theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'
          }`}>
            <span>Tần suất:</span>
            <select
              value={inferenceIntervalMs}
              onChange={(e) => setInferenceIntervalMs(Number(e.target.value))}
              className={`rounded px-1.5 py-0.5 text-xs font-semibold border focus:outline-none ${
                theme === 'light'
                  ? 'bg-white border-slate-300 text-slate-800 shadow-sm'
                  : 'bg-black/40 border-white/10 text-slate-300'
              }`}
            >
              <option value={150}>150ms (~6 FPS)</option>
              <option value={300}>300ms (~3 FPS)</option>
              <option value={500}>500ms (~2 FPS)</option>
            </select>
          </div>
        </div>

        {/* Prediction Results & Probabilities */}
        {lastPrediction && (
          <div
            className={`rounded-2xl border p-4 space-y-4 shadow-xl transition-colors ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900 shadow-slate-100'
                : 'bg-[#0c1019] border-white/10 text-slate-100'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between text-xs">
              <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-300'}`}>
                Phân phối xác suất (Probability Distribution)
              </span>
              <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-500'}`}>
                Thiết bị: {lastPrediction.device.toUpperCase()}
              </span>
            </div>

            {/* Probability Bars */}
            <div className="space-y-2.5">
              {lastPrediction.probabilities.map((item) => {
                const isTop = item.index === lastPrediction.predicted_index
                const pct = item.probability * 100
                return (
                  <div key={item.index} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className={`font-semibold ${
                        theme === 'light'
                          ? isTop
                            ? 'text-sky-800 font-bold'
                            : 'text-slate-700'
                          : isTop
                          ? 'text-cyan-300'
                          : 'text-slate-300'
                      }`}>
                        {item.label}
                      </span>
                      <span className={`font-mono ${
                        theme === 'light'
                          ? isTop
                            ? 'text-sky-700 font-bold'
                            : 'text-slate-600 font-semibold'
                          : isTop
                          ? 'text-cyan-400 font-bold'
                          : 'text-slate-400'
                      }`}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden border ${
                      theme === 'light'
                        ? 'bg-slate-100 border-slate-200'
                        : 'bg-white/5 border-white/5'
                    }`}>
                      <div
                        className={`h-full transition-all duration-150 ${
                          theme === 'light'
                            ? isTop
                              ? 'bg-gradient-to-r from-sky-500 to-blue-600 shadow-sm'
                              : 'bg-slate-300'
                            : isTop
                            ? 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/50'
                            : 'bg-white/20'
                        }`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Student Feedback & Accuracy Tally */}
            <div className={`pt-3 border-t flex items-center justify-between ${
              theme === 'light' ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="text-xs">
                <span className={theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                  Mô hình đoán đúng không?
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFeedback(true)}
                  disabled={feedbackSent}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition ${
                    theme === 'light'
                      ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-sm'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>Đúng</span>
                </button>

                <button
                  onClick={() => handleFeedback(false)}
                  disabled={feedbackSent}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition ${
                    theme === 'light'
                      ? 'bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 shadow-sm'
                      : 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Sai</span>
                </button>
              </div>
            </div>

            {/* Live Student Evaluation Tally */}
            {feedbackStats && feedbackStats.total > 0 && (
              <div className={`text-[11px] font-mono p-2 rounded-xl text-center border ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : 'bg-white/5 border-white/5 text-slate-300'
              }`}>
                Thử nghiệm học sinh: Đạt{' '}
                <strong className={theme === 'light' ? 'text-emerald-700 font-bold' : 'text-emerald-400'}>
                  {feedbackStats.correct}/{feedbackStats.total}
                </strong>{' '}
                ảnh đúng ({formatPercent(feedbackStats.accuracy)})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
