import React, { useEffect, useRef, useState } from 'react'
import {
  Camera,
  Check,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Video,
  X,
} from 'lucide-react'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'
import type { Subset } from '@/types/api'

interface WebcamCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  classId: string
  classNameTitle: string
}

export const WebcamCaptureModal: React.FC<WebcamCaptureModalProps> = ({
  isOpen,
  onClose,
  classId,
  classNameTitle,
}) => {
  const { currentProject, loadDataset } = useLabStore()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [hasCamera, setHasCamera] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [subset, setSubset] = useState<Subset>('train')
  const [isCapturingSession, setIsCapturingSession] = useState(false)
  const [capturedCount, setCapturedCount] = useState(0)
  const [sessionId, setSessionId] = useState<string>(() => `sess_${Date.now()}`)
  const intervalRef = useRef<any>(null)

  const startCamera = async () => {
    setErrorMessage(null)
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
      setHasCamera(true)
    } catch (err: any) {
      console.error('Camera access error:', err)
      setHasCamera(false)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Quyền truy cập Webcam bị từ chối. Vui lòng cấp quyền camera trong cài đặt trình duyệt để tiếp tục.'
        )
      } else {
        setErrorMessage(`Không tìm thấy Webcam hoặc camera đang được sử dụng bởi ứng dụng khác: ${err.message}`)
      }
    }
  }

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsCapturingSession(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setHasCamera(false)
  }

  useEffect(() => {
    if (isOpen) {
      setSessionId(`sess_${Date.now()}`)
      setCapturedCount(0)
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen])

  const captureFrame = async (): Promise<boolean> => {
    if (!videoRef.current || !canvasRef.current || !currentProject) return false
    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return new Promise((resolve) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            resolve(false)
            return
          }
          const file = new File([blob], `frame_${Date.now()}.jpg`, { type: 'image/jpeg' })
          try {
            await api.uploadImages(
              currentProject.id,
              classId,
              [file],
              subset,
              sessionId,
              'webcam'
            )
            setCapturedCount((prev) => prev + 1)
            resolve(true)
          } catch (e) {
            console.error('Upload frame failed:', e)
            resolve(false)
          }
        },
        'image/jpeg',
        0.85
      )
    })
  }

  const handleSingleCapture = async () => {
    await captureFrame()
    loadDataset()
  }

  const toggleSessionCapture = () => {
    if (isCapturingSession) {
      clearInterval(intervalRef.current)
      setIsCapturingSession(false)
      loadDataset()
    } else {
      setIsCapturingSession(true)
      // capture at ~3 FPS
      intervalRef.current = setInterval(async () => {
        await captureFrame()
      }, 350)
    }
  }

  const handleFinish = () => {
    stopCamera()
    loadDataset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-[#0c1019] border border-cyan-500/30 p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">
                Chụp ảnh Webcam: <span className="text-cyan-400 font-bold">{classNameTitle}</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Di chuyển vật thể ở nhiều góc độ và khoảng cách khác nhau
              </p>
            </div>
          </div>
          <button onClick={handleFinish} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Canvas Container */}
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-black border border-white/10 flex items-center justify-center shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]" // mirror view
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Error Banner */}
          {errorMessage && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <Video className="w-10 h-10 text-rose-400" />
              <p className="text-xs text-rose-200 max-w-sm">{errorMessage}</p>
              <button
                onClick={startCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử kết nối lại</span>
              </button>
            </div>
          )}

          {/* Recording indicator */}
          {isCapturingSession && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/90 text-white text-[11px] font-mono animate-pulse shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>Đang chụp phiên ({capturedCount} ảnh)</span>
            </div>
          )}

          {/* Counter badge */}
          {capturedCount > 0 && !isCapturingSession && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-emerald-500/90 text-slate-950 font-bold text-[11px] font-mono shadow-lg">
              +{capturedCount} ảnh đã chụp
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            {/* Subset selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px]">Chụp cho tập:</span>
              <div className="flex rounded-lg bg-black/40 border border-white/10 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSubset('train')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    subset === 'train' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Train
                </button>
                <button
                  type="button"
                  onClick={() => setSubset('val')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    subset === 'val' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Validation riêng
                </button>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              Session ID: <span className="text-cyan-400">{sessionId.slice(-6)}</span>
            </div>
          </div>

          {/* Main Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              onClick={handleSingleCapture}
              disabled={!hasCamera || isCapturingSession}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold disabled:opacity-30 transition"
            >
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>Chụp 1 tấm</span>
            </button>

            <button
              onClick={toggleSessionCapture}
              disabled={!hasCamera}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-lg ${
                isCapturingSession
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25 animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/25'
              }`}
            >
              {isCapturingSession ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Dừng chụp phiên</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Bắt đầu chụp liên tục (~3 FPS)</span>
                </>
              )}
            </button>

            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
            >
              <Check className="w-4 h-4" />
              <span>Xong</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
