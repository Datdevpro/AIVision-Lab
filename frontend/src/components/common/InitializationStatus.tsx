import { useEffect } from 'react'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'

export function InitializationStatus() {
  const { initializationStatus, initializationError, initializeApp, theme } = useLabStore()
  useEffect(() => {
    if (initializationStatus !== 'error') return
    const timer = window.setTimeout(() => { void initializeApp() }, 3000)
    return () => window.clearTimeout(timer)
  }, [initializationStatus, initializeApp])
  if (initializationStatus === 'ready') return null
  const failed = initializationStatus === 'error'
  return <div role={failed ? 'alert' : 'status'} className={`shrink-0 flex items-start gap-3 border-b px-4 py-2 text-xs ${theme === 'light' ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'}`}>
    {failed ? <AlertCircle size={16} className="shrink-0" /> : <Loader2 size={16} className="shrink-0 animate-spin" />}
    <div className="flex-1 min-w-0"><strong>{failed ? 'Chưa tải đủ dữ liệu hệ thống' : 'Đang kết nối backend và tải dữ liệu…'}</strong>
      {initializationError && <p className="mt-1 whitespace-pre-line break-words">{initializationError} {failed ? 'Hệ thống sẽ tự thử lại.' : 'Đang thử kết nối lại…'}</p>}
    </div>
    <button type="button" disabled={!failed} onClick={() => { void initializeApp() }} className="flex items-center gap-1 whitespace-nowrap disabled:opacity-50"><RefreshCw size={13} />Thử lại</button>
  </div>
}
