import { useEffect, useId, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, Maximize2, Minimize2, Minus, Pause, Play, Plus, RotateCcw, X } from 'lucide-react'
import { useLabStore, type NetworkSource } from '@/store/useLabStore'
import { TrainingMetricsChart } from '../analytics/TrainingMetricsChart'
import './network-visualizer.css'
import { isFlowRunning, trainingStatusLabels } from './training-flow'

type Layer = { id: string; title: string; subtitle: string; count: number; kind: 'input' | 'feature' | 'dense' | 'output' }
type Neuron = { id: string; layer: number; index: number; x: number; y: number }
const BLUE = '#168ac1'
const ORANGE = '#ed983e'
const MAX_VISIBLE = 6
// Deterministic illustration; these values are not checkpoint weights.
const illustrativeWeight = (a: number, b: number, layer: number) => Math.sin((a + 1) * 7.13 + (b + 1) * 3.71 + layer * 1.9)

function Stepper({ value, min, max, step = 1, disabled, label, onChange }: {
  value: number; min: number; max: number; step?: number; disabled: boolean; label: string; onChange: (n: number) => void
}) {
  return <span className="nv-stepper">
    <button aria-label={`Giảm ${label}`} title={`Giảm ${label}`} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - step))}><Minus size={13} /></button>
    <span>{value}</span>
    <button aria-label={`Tăng ${label}`} title={`Tăng ${label}`} disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + step))}><Plus size={13} /></button>
  </span>
}

export function NetworkVisualizer() {
  const { config, dataset, activeExperiment, activeJob, isTraining, paramSpecs, theme, updateConfig, setSelectedLessonKey, networkSource: source, setNetworkSource: setSource } = useLabStore()
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [pausedJobId, setPausedJobId] = useState<string | null>(null)
  const [selection, setSelection] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [showConnections, setShowConnections] = useState(true)
  const uid = useId().replace(/:/g, '')
  const viewSource = source === 'auto' ? (activeJob ? 'job' : activeExperiment ? 'experiment' : 'draft') : source === 'experiment' && !activeExperiment || source === 'job' && !activeJob ? 'draft' : source
  const experiment = viewSource === 'experiment' ? activeExperiment : null
  const job = viewSource === 'job' ? activeJob : null
  const cfg = experiment?.config ?? job?.config ?? config
  const custom = (experiment?.architecture ?? (cfg.mode === 'advanced' ? 'custom_cnn' : 'mobilenet_v3_small')) === 'custom_cnn'
  const denseCount = cfg.mode === 'beginner' ? 1 : cfg.dense_layers
  const neurons = cfg.mode === 'beginner' ? 64 : cfg.neurons
  const names = experiment?.class_names ?? (job ? job.dataset_summary.per_class.map(c => c.name) : dataset?.classes.map(c => c.name)) ?? []
  const featureDim = custom ? cfg.conv_filters[cfg.conv_blocks - 1] : 576
  const editable = viewSource === 'draft' && cfg.mode !== 'beginner' && !isTraining
  const layerSpec = paramSpecs.find(s => s.key === 'dense_layers')
  const neuronSpec = paramSpecs.find(s => s.key === 'neurons')
  const layers: Layer[] = [
    { id: 'rgb', title: 'ĐẦU VÀO', subtitle: `${custom ? 64 : 224} × ${custom ? 64 : 224} × 3`, count: 3, kind: 'input' },
    { id: 'features', title: 'ĐẶC TRƯNG', subtitle: `${featureDim} chiều · ${custom ? `${cfg.conv_blocks} khối Conv` : 'MobileNetV3 · đóng băng'}`, count: featureDim, kind: 'feature' },
    ...Array.from({ length: denseCount }, (_, i): Layer => ({ id: `dense-${i}`, title: `LỚP ẨN ${i + 1}`, subtitle: `${neurons} neuron · ${cfg.activation.toUpperCase()}`, count: neurons, kind: 'dense' })),
    { id: 'output', title: 'ĐẦU RA', subtitle: `${names.length} lớp · Softmax`, count: names.length, kind: 'output' },
  ]
  // Reserve a full column for every layer, including the outer labels.
  const width = layers.length * 180
  const waveWidth = Math.max(120, width * 0.24)
  const columnX = (column: number) => 90 + column * 180
  const graph = layers.map((layer, column) => {
    const visible = Math.min(MAX_VISIBLE, layer.count)
    return Array.from({ length: visible }, (_, index): Neuron => ({
      id: `${layer.id}-${index}`, layer: column, index,
      x: columnX(column), y: 200 + (index - (visible - 1) / 2) * 40,
    }))
  })
  const connections = graph.slice(0, -1).flatMap((column, li) => column.flatMap(a => graph[li + 1].map(b => ({
    id: `${a.id}-${b.id}`, from: a.id, to: b.id,
    weight: illustrativeWeight(a.index, b.index, li),
    path: `M${a.x + 13},${a.y} C${a.x + 85},${a.y} ${b.x - 85},${b.y} ${b.x - 13},${b.y}`,
  }))))
  const selected = graph.flat().find(n => n.id === selection)
  const focused = hovered ?? selected?.id
  const selectedLayer = selected ? layers[selected.layer] : null
  const metrics = experiment?.epoch_metrics ?? job?.epochs ?? []
  const latest = metrics.at(-1)
  const running = job ? isFlowRunning(job.status) && pausedJobId !== job.id : playing
  const progress = Math.min(1, Math.max(0, job?.progress ?? 0))
  const currentEpoch = Math.max(job?.batch?.epoch ?? 0, latest?.epoch ?? 0)
  const useBatchMetrics = job?.batch && (job.status === 'training' || job.batch.epoch > (latest?.epoch ?? 0))
  const liveLoss = useBatchMetrics ? job?.batch?.loss : latest?.train_loss
  const liveAccuracy = useBatchMetrics ? job?.batch?.accuracy : latest?.train_accuracy

  const changeSource = (next: NetworkSource) => {
    setSource(next)
    setSelection(null)
    setPlaying(false)
  }

  useEffect(() => {
    if (!expanded) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [expanded])

  const content = <section className={`nv ${theme === 'light' ? 'nv-light' : ''} ${expanded ? 'nv-expanded' : ''}`} aria-label="Network Playground">
    <div className="nv-toolbar">
      <div><span className="nv-eyebrow">KHÁM PHÁ KIẾN TRÚC</span><h3>Network Playground <span>Thấy cách các lớp kết nối</span></h3></div>
      <div className="nv-actions">
        <select aria-label="Nguồn cấu hình mạng" value={source === 'auto' ? source : viewSource} onChange={e => changeSource(e.target.value as NetworkSource)}>
          <option value="auto">Tự động theo phiên huấn luyện</option>
          <option value="draft">Cấu hình đang thiết kế</option>
          {activeJob && <option value="job">Phiên huấn luyện hiện tại</option>}
          {activeExperiment && <option value="experiment">Mô hình: {activeExperiment.name}</option>}
        </select>
        <button className={running ? 'nv-primary nv-active' : 'nv-primary'} disabled={!!job && !isFlowRunning(job.status)} onClick={() => job ? setPausedJobId(running ? job.id : null) : setPlaying(!playing)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Tạm dừng hiệu ứng' : job ? 'Tiếp tục hiệu ứng' : 'Luồng tín hiệu'}</button>
        <button title="Đặt lại mô phỏng và lựa chọn" aria-label="Đặt lại mô phỏng và lựa chọn" onClick={() => { setPlaying(false); setPausedJobId(job?.id ?? null); setSelection(null); setHovered(null) }}><RotateCcw size={15} /></button>
        <button title={expanded ? 'Thu nhỏ (Esc)' : 'Mở rộng sơ đồ'} aria-label={expanded ? 'Thu nhỏ sơ đồ' : 'Mở rộng sơ đồ'} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
      </div>
    </div>
    {job && <div className={`nv-training nv-training-${job.status}`}>
      <div className="nv-training-heading"><strong role="status">{trainingStatusLabels[job.status]}</strong><span>Epoch {currentEpoch} / {job.total_epochs}</span><span>{(progress * 100).toFixed(0)}%</span></div>
      <progress aria-label="Tiến độ huấn luyện thực" max={1} value={progress} />
      <div className="nv-training-metrics">
        {job.status === 'training' && job.batch && <span>Batch {job.batch.batch}/{job.batch.total_batches}</span>}
        <span>Train loss: {liveLoss?.toFixed(4) ?? '—'}</span><span>Train accuracy: {liveAccuracy == null ? '—' : `${(liveAccuracy * 100).toFixed(1)}%`}</span>
        {latest && <><span>Val loss: {latest.val_loss.toFixed(4)}</span><span>Val accuracy: {(latest.val_accuracy * 100).toFixed(1)}%</span></>}
      </div>
      {job.status === 'failed' && <p role="alert">{job.error?.message ?? job.message ?? trainingStatusLabels.failed}</p>}
    </div>}
    <div className="nv-configbar">
      <span className="nv-config-label">ĐẦU PHÂN LOẠI</span>
      <label>Lớp ẩn <Stepper value={denseCount} min={layerSpec?.min ?? 0} max={layerSpec?.max ?? 3} disabled={!editable} label="số lớp ẩn" onChange={n => updateConfig({ dense_layers: n })} /></label>
      <label>Neuron / lớp <Stepper value={neurons} min={neuronSpec?.min ?? 8} max={neuronSpec?.max ?? 512} step={neuronSpec?.step ?? 8} disabled={!editable || denseCount === 0} label="số neuron mỗi lớp ẩn" onChange={n => updateConfig({ neurons: n })} /></label>
      <span className="nv-tag">{cfg.activation.toUpperCase()}</span><span className="nv-muted">Dropout {cfg.dropout}</span>
      <span className="nv-edit-hint">
        {isTraining ? 'Đang huấn luyện · kiến trúc của phiên chạy không thay đổi' : viewSource !== 'draft' ? 'Kiến trúc đã lưu · chỉ xem' : cfg.mode === 'beginner' ? 'Chuyển sang Trung cấp hoặc Advanced để chỉnh kiến trúc' : 'Đồng bộ với Huấn luyện mô hình · áp dụng cho lần chạy tiếp theo'}
        {!isTraining && viewSource !== 'draft' && <button onClick={() => changeSource('draft')}>Chỉnh cấu hình đang thiết kế</button>}
      </span>
    </div>
    <div className="nv-workspace">
      <div className="nv-network">
        <div className="nv-graph-scroll">
          <svg className="nv-graph" viewBox={`0 0 ${width} 360`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: layers.length * 145 }} role="group" aria-label="Sơ đồ các neuron và kết nối minh họa">
            <defs>
              {graph.flat().map(node => <linearGradient key={node.id} id={`${uid}-${node.id}`} x1="0" y1="0" x2={node.index % 2 ? '0' : '1'} y2={node.index % 2 ? '1' : '0'}><stop offset="0%" stopColor={ORANGE} /><stop offset={`${30 + node.index * 8}%`} stopColor="#f4f1e9" /><stop offset="100%" stopColor={BLUE} /></linearGradient>)}
              {running && showConnections && <>
                <linearGradient id={`${uid}-wave`}>
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="35%" stopColor="white" stopOpacity="0.12" />
                  <stop offset="75%" stopColor="white" stopOpacity="1" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <mask id={`${uid}-wave-mask`} maskUnits="userSpaceOnUse" x="0" y="80" width={width} height="240">
                  <rect className="nv-wave-band" x={-waveWidth} y="80" width={waveWidth} height="240" fill={`url(#${uid}-wave)`} style={{ '--nv-wave-distance': `${width + waveWidth}px` } as CSSProperties} />
                </mask>
              </>}
            </defs>
            {layers.map((layer, i) => <g key={layer.id}>
              <text x={columnX(i)} y="25" textAnchor="middle" className="nv-layer-title">{layer.title}</text>
              <text x={columnX(i)} y="46" textAnchor="middle" className="nv-layer-subtitle">{layer.subtitle.split(' · ').map((line, index) => <tspan key={index} x={columnX(i)} dy={index ? 15 : 0}>{line}</tspan>)}</text>
              <text x={columnX(i)} y="343" textAnchor="middle" className="nv-layer-subtitle">{layer.count > MAX_VISIBLE ? `Hiển thị ${MAX_VISIBLE} / ${layer.count}` : layer.kind === 'input' ? 'Kênh R · G · B' : layer.kind === 'output' && !names.length ? 'Thêm lớp trong Dataset Studio' : `${layer.count} ${layer.kind === 'output' ? 'lớp mục tiêu' : 'neuron'}`}</text>
            </g>)}
            {showConnections && connections.map(connection => {
              const related = !focused || connection.from === focused || connection.to === focused
              return <path key={connection.id} d={connection.path} fill="none" stroke={connection.weight > 0 ? BLUE : ORANGE} strokeWidth={0.6 + Math.abs(connection.weight) * 0.8} opacity={focused && related ? 0.85 : related ? 0.16 : 0.035} />
            })}
            {running && showConnections && <g className="nv-wave-connections" mask={`url(#${uid}-wave-mask)`} aria-hidden="true">
              {connections.map(connection => <path key={connection.id} d={connection.path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />)}
            </g>}
            {graph.flat().map(node => {
              const layer = layers[node.layer]
              const label = layer.kind === 'input' ? ['R', 'G', 'B'][node.index] : layer.kind === 'output' ? names[node.index] : `n${node.index + 1}`
              const active = selected?.id === node.id || hovered === node.id
              return <g key={node.id} role="button" tabIndex={0} aria-label={`${layer.title}, ${label} — xem chi tiết`} aria-pressed={selected?.id === node.id} onClick={() => setSelection(node.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelection(node.id) } }} onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(node.id)} onBlur={() => setHovered(null)} className="nv-neuron">
                <title>{`${layer.title} · ${label} · Bấm để xem chi tiết`}</title>
                <rect x={node.x - 18} y={node.y - 18} width="36" height="36" fill="transparent" />
                <rect x={node.x - 13} y={node.y - 13} width="26" height="26" rx="5" className={active ? 'nv-neuron-frame nv-selected' : 'nv-neuron-frame'} />
                <rect x={node.x - 9} y={node.y - 9} width="18" height="18" rx="2" fill={layer.kind === 'input' ? ['#ee9b81', '#88be9c', '#83b8de'][node.index] : `url(#${uid}-${node.id})`} />
                <text x={node.x + 21} y={node.y + 4} className="nv-neuron-label">{label.length > 10 ? `${label.slice(0, 9)}…` : label}</text>
              </g>
            })}
          </svg>
        </div>
        <div className="nv-legend"><label><input type="checkbox" checked={showConnections} onChange={e => setShowConnections(e.target.checked)} /> Hiện kết nối</label><span><i style={{ background: ORANGE }} /> Âm</span><span className="nv-color-scale" /><span><i style={{ background: BLUE }} /> Dương</span><span className="nv-muted">Màu và độ dày: trọng số minh họa</span></div>
        {selectedLayer && <div className="nv-selection" role="status">
          <div><strong>{selectedLayer.title} · {selected!.index + 1}</strong><p>{selectedLayer.kind === 'input' ? 'Một kênh màu của ảnh RGB sau khi thay đổi kích thước và chuẩn hóa.' : selectedLayer.kind === 'feature' ? `Một trong ${featureDim} đặc trưng sau bước trích xuất và global average pooling.` : selectedLayer.kind === 'output' ? `Đầu ra cho lớp “${names[selected!.index]}”. Softmax chuyển các logits thành xác suất có tổng bằng 100%.` : `Neuron nhận tổng có trọng số từ lớp trước, cộng bias, rồi áp dụng ${cfg.activation.toUpperCase()}. Dropout ${cfg.dropout} chỉ áp dụng khi huấn luyện.`}</p></div>
          <button aria-label="Đóng chi tiết neuron" onClick={() => setSelection(null)}><X size={13} /></button>
        </div>}
      </div>
      <section className="nv-charts" aria-label="Biểu đồ huấn luyện">
        <TrainingMetricsChart epochs={metrics} bestEpoch={experiment?.best_checkpoint?.epoch} />
      </section>
    </div>
    <footer className="nv-footer"><span><b>Sơ đồ kiến trúc · mô phỏng minh họa.</b> Tối đa {MAX_VISIBLE} neuron đại diện mỗi cột. Các lớp dense dùng chung số neuron; CNN được thu gọn ở cột đặc trưng.</span><button onClick={() => setSelectedLessonKey('hidden_layer')}><HelpCircle size={13} /> Tìm hiểu lớp ẩn</button></footer>
  </section>
  return expanded ? createPortal(content, document.body) : content
}
