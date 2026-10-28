import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, ArrowRight, BookOpen, Check, CloudDownload, Flower2, HardDrive, Loader2, X } from 'lucide-react'
import { api } from '@/services/api'
import { useLabStore } from '@/store/useLabStore'
import type { SampleDataset, SampleImportJob } from '@/types/api'

const PENDING_KEY = 'visionlab_flower_import'

interface Props { open: boolean; onClose: () => void }

export const SampleDatasetLibrary: React.FC<Props> = ({ open, onClose }) => {
  const { theme, config, isTraining, isSampleImporting, setSampleImporting, activateImportedProject } = useLabStore()
  const dialog = useRef<HTMLDialogElement>(null)
  const [dataset, setDataset] = useState<SampleDataset | null>(null)
  const [selected, setSelected] = useState(['daisy', 'dandelion', 'roses', 'sunflowers', 'tulips'])
  const [count, setCount] = useState('100')
  const [error, setError] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [job, setJob] = useState<SampleImportJob | null>(null)
  const [jobId, setJobId] = useState<string | null>(() => sessionStorage.getItem(PENDING_KEY))
  const [starting, setStarting] = useState(false)
  const [pollAttempt, setPollAttempt] = useState(0)
  const light = theme === 'light'

  const loadCatalog = async () => {
    setCatalogLoading(true)
    if (!jobId) setError(null)
    try {
      const result = await api.getSampleDatasets()
      const flowers = result.datasets.find(d => d.id === 'flowers')
      if (!flowers) throw new Error('Chưa có Flower Photos trong thư viện.')
      setDataset(flowers)
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được thư viện dataset.') }
    finally { setCatalogLoading(false) }
  }

  useEffect(() => {
    if (open) {
      if (!dialog.current?.open) dialog.current?.showModal()
      void loadCatalog()
    } else dialog.current?.close()
  }, [open])

  useEffect(() => {
    if (!jobId) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    setSampleImporting(true)
    const poll = async () => {
      try {
        const next = await api.getSampleImport(jobId)
        if (disposed) return
        setJob(next)
        if (next.status === 'completed' && next.project_id) {
          await activateImportedProject(next.project_id)
          if (disposed) return
          sessionStorage.removeItem(PENDING_KEY)
          setJobId(null)
          setSampleImporting(false)
          onClose()
        } else if (next.status === 'failed') {
          setError(next.error || next.message)
          sessionStorage.removeItem(PENDING_KEY)
          setJobId(null)
          setSampleImporting(false)
        } else timer = setTimeout(poll, 900)
      } catch (e) {
        if (disposed) return
        setError(e instanceof Error ? e.message : 'Không đọc được tiến độ import.')
        // Retain the ID during network failures; retry observes the same import.
        if (e instanceof Error && 'status' in e && e.status === 404) {
          sessionStorage.removeItem(PENDING_KEY)
          setJobId(null)
          setSampleImporting(false)
        }
      }
    }
    void poll()
    return () => { disposed = true; clearTimeout(timer) }
  }, [jobId, pollAttempt, activateImportedProject, setSampleImporting, onClose])

  const imagesPerClass = Number(count)
  const total = imagesPerClass * selected.length
  const maxPerClass = dataset ? Math.min(dataset.max_images_per_class,
    Math.floor(dataset.max_images_per_project / Math.max(1, selected.length))) : 500
  const selectionError = !dataset ? null
    : selected.length < dataset.min_classes ? `Chọn ít nhất ${dataset.min_classes} loại hoa.`
    : selected.length > dataset.max_classes ? `Ứng dụng cho phép tối đa ${dataset.max_classes} lớp.`
    : !Number.isInteger(imagesPerClass) || imagesPerClass < dataset.min_images_per_class || imagesPerClass > maxPerClass
    ? `Chọn từ ${dataset.min_images_per_class} đến ${maxPerClass} ảnh/lớp.` : null
  const busy = starting || isSampleImporting
  const downloadedMB = Math.round((job?.downloaded_bytes ?? 0) / 1024 / 1024)
  const percent = !job ? 0 : job.status === 'downloading'
    ? job.downloaded_bytes / job.download_bytes * 100
    : job.status === 'importing' ? job.imported_images / job.total_images * 100
    : job.status === 'completed' ? 100 : 0

  const startImport = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dataset || selectionError || busy || isTraining || jobId) return
    setStarting(true)
    setError(null)
    setJob(null)
    try {
      const result = await api.importFlowers(selected, imagesPerClass, config.seed)
      sessionStorage.setItem(PENDING_KEY, result.id)
      setJob(result)
      setJobId(result.id)
      setSampleImporting(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể bắt đầu import.') }
    finally { setStarting(false) }
  }

  return createPortal(
    <dialog ref={dialog} aria-labelledby="sample-library-title" onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === dialog.current) onClose() }}
      className={`m-auto w-[min(920px,calc(100vw-32px))] max-h-[90vh] overflow-y-auto rounded-3xl border p-0 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm ${light ? 'bg-white text-slate-900 border-slate-200' : 'bg-[#0c1320] text-slate-100 border-white/15'}`}>
      <form onSubmit={startImport}>
        <div className={`flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b ${light ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0"><BookOpen size={22} /></div>
            <div>
              <h2 id="sample-library-title" className="font-bold text-lg">Thư viện dataset mẫu</h2>
              <p className={`text-xs mt-1 ${light ? 'text-slate-600' : 'text-slate-400'}`}>Chọn dữ liệu có sẵn để bắt đầu thực hành.</p>
            </div>
          </div>
          <button type="button" aria-label="Đóng thư viện dataset" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-500/15"><X size={19} /></button>
        </div>

        <div className="p-6 space-y-5">
          {catalogLoading && !dataset && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} />Đang tải thư viện…</p>}
          {dataset && <>
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div><h3 className="font-bold text-base flex items-center gap-2"><Flower2 size={18} className="text-emerald-500" />Flower Photos</h3>
                <p className={`text-xs mt-2 max-w-lg leading-relaxed ${light ? 'text-slate-600' : 'text-slate-400'}`}>{dataset.description}</p></div>
              <span className={`inline-flex gap-1.5 items-center rounded-full px-3 py-1.5 text-[11px] font-semibold ${dataset.cached ? 'bg-emerald-500/10 text-emerald-600' : light ? 'bg-sky-50 text-sky-700' : 'bg-sky-500/10 text-sky-300'}`}>
                {dataset.cached ? <HardDrive size={13} /> : <CloudDownload size={13} />}{dataset.cached ? 'Có sẵn offline' : 'Tải lần đầu · 218 MiB'}
              </span>
            </div>

            <fieldset disabled={busy || !!jobId} className="space-y-3 disabled:opacity-60">
              <legend className="sr-only">Chọn loại hoa</legend>
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs font-semibold">Chọn loại hoa <span className={light ? 'text-slate-500' : 'text-slate-400'}>({selected.length}/5)</span></span>
                <button type="button" onClick={() => setSelected(selected.length === dataset.classes.length ? [] : dataset.classes.slice(0, dataset.max_classes).map(c => c.id))}
                  className={`text-xs font-semibold ${light ? 'text-sky-700' : 'text-cyan-300'}`}>{selected.length === dataset.classes.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {dataset.classes.map(cls => {
                  const checked = selected.includes(cls.id)
                  return <label key={cls.id} className={`relative rounded-2xl border overflow-hidden cursor-pointer transition focus-within:ring-2 focus-within:ring-sky-500 ${checked ? light ? 'border-emerald-500 bg-emerald-50' : 'border-emerald-400/70 bg-emerald-500/10' : light ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.02]'}`}>
                    <img src={cls.preview_url} alt={cls.name} className="w-full aspect-[4/3] object-cover" />
                    <input type="checkbox" aria-label={cls.name} checked={checked} onChange={() => setSelected(previous => checked ? previous.filter(key => key !== cls.id) : [...previous, cls.id])}
                      className="absolute top-2.5 right-2.5 w-4 h-4 accent-emerald-500" />
                    <div className="p-3"><div className="text-xs font-bold">{cls.name}</div><div className={`text-[10px] mt-1 ${light ? 'text-slate-500' : 'text-slate-400'}`}>{cls.available} ảnh có sẵn</div></div>
                  </label>
                })}
              </div>
            </fieldset>

            <div className={`grid sm:grid-cols-2 gap-5 p-4 rounded-2xl border ${light ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/10'}`}>
              <div>
                <label htmlFor="sample-image-count" className="block text-xs font-semibold mb-2">Số ảnh mỗi lớp</label>
                <div className="flex gap-2 items-center flex-wrap">
                  <input id="sample-image-count" type="number" min={dataset.min_images_per_class} max={maxPerClass} step="1" value={count}
                    disabled={busy || !!jobId} onChange={event => setCount(event.target.value)}
                    className={`w-24 rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500 ${light ? 'bg-white border-slate-300' : 'bg-black/20 border-white/15'}`} />
                  {[50, 100, 200].filter(n => n <= maxPerClass).map(n => <button key={n} type="button" disabled={busy || !!jobId} onClick={() => setCount(String(n))}
                    className={`text-[11px] px-2 py-1.5 rounded-lg ${imagesPerClass === n ? 'bg-emerald-500/15 text-emerald-600 font-bold' : 'bg-slate-500/10'}`}>{n}</button>)}
                </div>
                <p className={`text-[11px] mt-2 ${light ? 'text-slate-500' : 'text-slate-400'}`}>Ảnh được lấy ngẫu nhiên, cân bằng giữa các lớp.</p>
              </div>
              <div className={`sm:border-l sm:pl-5 ${light ? 'border-slate-200' : 'border-white/10'}`}>
                <div className="text-xs font-semibold">Dataset của bạn</div>
                <div className="text-2xl font-bold mt-1">{Number.isFinite(total) ? total.toLocaleString('vi-VN') : '—'} <span className="text-xs font-normal">ảnh / {selected.length} lớp</span></div>
                <p className={`text-[11px] mt-1 leading-relaxed ${light ? 'text-slate-500' : 'text-slate-400'}`}>Tạo dự án mới. Train/validation được chia tự động theo cấu hình huấn luyện.</p>
              </div>
            </div>

            {!dataset.cached && !busy && <p className={`text-[11px] leading-relaxed ${light ? 'text-slate-500' : 'text-slate-400'}`}>Lần đầu cần tải bộ gốc khoảng 218 MiB, kể cả khi chỉ chọn một phần ảnh. Các lần sau dùng lại dữ liệu đã lưu trên backend.</p>}
            {selectionError && !busy && <p role="status" className="text-xs text-amber-600">{selectionError}</p>}
            {isTraining && <p className="text-xs text-amber-600">Đợi phiên huấn luyện hiện tại kết thúc trước khi tạo dự án mẫu.</p>}
          </>}

          {(busy || (!!jobId && !error)) && <div role="status" aria-live="polite" className={`p-4 rounded-2xl border space-y-2 ${light ? 'bg-sky-50 border-sky-200' : 'bg-sky-500/10 border-sky-400/20'}`}>
            <div className="flex items-center gap-2 text-xs font-semibold"><Loader2 size={15} className="animate-spin" />{job?.message || 'Đang bắt đầu import…'}</div>
            <div role="progressbar" aria-label="Tiến độ chuẩn bị dataset" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 rounded-full bg-slate-500/15 overflow-hidden">
              <div className={`h-full bg-sky-500 transition-all ${job?.status === 'extracting' || job?.status === 'preparing' ? 'w-1/3 animate-pulse' : ''}`} style={job?.status === 'downloading' || job?.status === 'importing' || job?.status === 'completed' ? { width: `${percent}%` } : undefined} />
            </div>
            {job?.status === 'downloading' && <p className="text-[11px]">{downloadedMB} / 218 MiB</p>}
            <p className={`text-[11px] ${light ? 'text-slate-500' : 'text-slate-400'}`}>Bạn có thể đóng hộp thoại; quá trình vẫn tiếp tục.</p>
          </div>}
          {error && <div role="alert" className={`p-3 rounded-xl text-xs flex items-start gap-2 ${light ? 'bg-rose-50 text-rose-700' : 'bg-rose-500/10 text-rose-300'}`}>
            <AlertCircle size={16} className="shrink-0" /><div className="space-y-2"><p>{error}</p>
              {!dataset && <button type="button" onClick={() => void loadCatalog()} className="underline">Tải lại thư viện</button>}
              {jobId && <button type="button" onClick={() => { setError(null); setPollAttempt(attempt => attempt + 1) }} className="underline">Kiểm tra lại tiến độ</button>}
            </div>
          </div>}
        </div>

        <div className={`flex flex-wrap justify-between items-center gap-4 px-6 py-4 border-t ${light ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/10'}`}>
          <div className={`text-[11px] ${light ? 'text-slate-500' : 'text-slate-400'}`}>
            <a href="https://www.tensorflow.org/tutorials/load_data/images" target="_blank" rel="noreferrer" className="hover:underline">Nguồn: TensorFlow</a>
            {' · '}<a href="/datasets/flowers/LICENSE.txt" target="_blank" rel="noreferrer" className="hover:underline">Ảnh CC BY · Tác giả</a>
          </div>
          <button type="submit" disabled={!dataset || !!selectionError || busy || isTraining || !!jobId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-45 disabled:cursor-not-allowed">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{busy ? 'Đang chuẩn bị…' : 'Tạo dự án từ dataset'}{!busy && <ArrowRight size={15} />}
          </button>
        </div>
      </form>
    </dialog>, document.body,
  )
}
