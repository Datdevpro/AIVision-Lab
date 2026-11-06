import React from 'react'
import { useLabStore } from '@/store/useLabStore'
import { formatNumber, formatPercent } from '@/lib/utils'
import { scoreModel } from './model-score'
import type { Experiment } from '@/types/api'

export const ModelScoreView: React.FC<{ experiment?: Experiment; compact?: boolean }> = ({ experiment: providedExperiment, compact = false }) => {
  const { activeExperiment, activeJob, theme } = useLabStore()
  const experiment = providedExperiment ?? activeExperiment
  const light = theme === 'light'
  const training = !providedExperiment && activeJob && !['completed', 'failed', 'cancelled'].includes(activeJob.status)
  if (training) return <p role="status" className="p-8 text-center text-sm opacity-70">Đang huấn luyện. Bảng đánh giá sẽ xuất hiện khi có kết quả hoàn tất.</p>
  if (!experiment?.evaluation?.validation) return <p role="status" className="p-8 text-center text-sm opacity-70">Chưa có kết quả đánh giá. Hãy hoàn thành một lần huấn luyện để xem điểm mô hình.</p>

  const { rows, total, loss, baselineLoss, report } = scoreModel(experiment)
  const card = light ? 'border-slate-200 bg-white text-slate-800' : 'border-white/10 bg-[#0c1019] text-slate-200'
  const accent = light ? 'text-sky-800' : 'text-cyan-300'
  return <section aria-label="Bảng đánh giá mô hình" className="p-2 space-y-4 text-xs">
    <div className={`rounded-2xl border p-5 flex flex-wrap justify-between items-center gap-4 ${card}`}>
      <div className="space-y-2">
        <h2 className="text-base font-bold">Đánh giá mô hình</h2>
        <p className="font-semibold break-words">{experiment.name}</p>
        <p className="opacity-70">Checkpoint tốt nhất: epoch {experiment.best_epoch ?? experiment.evaluation?.checkpoint_epoch ?? '—'} · Validation: {report?.num_samples ?? 0} ảnh · {experiment.class_names.length} lớp</p>
      </div>
      <div aria-label="Tổng điểm" className={`font-mono ${accent}`}>
        <strong className="text-4xl">{total === null ? '—' : formatNumber(total, 2)}</strong><span className="text-lg"> / 100</span>
        <p className="mt-1 text-xs">{total === null ? 'Chưa đủ dữ liệu để tính tổng điểm' : 'Tổng điểm theo trọng số'}</p>
      </div>
    </div>
    {!compact && <><div className={`rounded-2xl border overflow-x-auto ${card}`}>
      <table className="w-full text-left min-w-[650px]">
        <caption className="sr-only">Bốn tiêu chí đánh giá với trọng số 35%, 20%, 20%, 25%</caption>
        <thead className={light ? 'bg-slate-50' : 'bg-white/5'}><tr>
          {['Tiêu chí', 'Trọng số', 'Giá trị đo', 'Mức đạt', 'Điểm đóng góp'].map(label => <th key={label} className="p-4">{label}</th>)}
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.key} className={`border-t ${light ? 'border-slate-200' : 'border-white/10'}`}>
          <td className="p-4 max-w-xs"><div className="font-semibold">{row.label}</div><p className="opacity-70 mt-1 leading-relaxed">{row.description}</p></td>
          <td className="p-4 font-mono">{row.weight}%</td>
          <td className={`p-4 font-mono font-bold ${accent}`}>{row.key === 'loss' ? (loss === null ? '—' : formatNumber(loss, 4)) : (row.quality === null ? '—' : formatPercent(row.quality))}</td>
          <td className="p-4 min-w-32">{row.quality === null ? <span className="opacity-70">Chưa đủ dữ liệu</span> : <>
            <div role="progressbar" aria-label={`Mức đạt ${row.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.quality * 100} className={`h-2 rounded-full overflow-hidden ${light ? 'bg-slate-200' : 'bg-white/10'}`}>
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${row.quality * 100}%` }} />
            </div><div className="font-mono mt-1">{formatPercent(row.quality)}</div>
          </>}</td>
          <td className="p-4 font-mono whitespace-nowrap">{row.points === null ? '—' : formatNumber(row.points, 2)} / {row.weight}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className={`rounded-xl border p-4 space-y-2 leading-relaxed ${card}`}>
      <h3 className="font-semibold">Cách tính điểm</h3>
      <p>Accuracy, F1 Macro và Recall thấp nhất: điểm = tỷ lệ đạt × trọng số. Điểm lớp yếu nhất = 20 × min(Recall từng lớp), với Recall ở thang 0–1. Tất cả chỉ số lấy trên cùng tập validation và cùng checkpoint tốt nhất.</p>
      <p>Overall Loss dùng validation cross-entropy loss, không dùng train loss hoặc loss của epoch cuối. Điểm loss = 25 × max(0, 1 − loss / ln(K)), với K là số lớp.</p>
      <p>Với {experiment.class_names.length} lớp, mốc xác suất đều là ln(K) = {baselineLoss === null ? '—' : formatNumber(baselineLoss, 4)}. Loss bằng 0 được 25 điểm; loss từ mốc này trở lên được 0 điểm. Đây là mốc gán xác suất đều cho mọi lớp, không phải baseline theo tần suất lớp.</p>
      <p className="opacity-70">Thang điểm thực hành theo quy ước, không phải xác suất mô hình đúng hay chuẩn chứng nhận chất lượng. Loss không đo tính hội tụ. Nếu thiếu ảnh đánh giá ở bất kỳ lớp nào, tổng điểm chưa được tính. Kết quả phụ thuộc dữ liệu và cách chia tập; validation đã được dùng để chọn checkpoint.</p>
      {report?.warnings?.map((warning, index) => <p key={index} className={light ? 'text-amber-800' : 'text-amber-300'}>{warning}</p>)}
    </div></>}
  </section>
}
