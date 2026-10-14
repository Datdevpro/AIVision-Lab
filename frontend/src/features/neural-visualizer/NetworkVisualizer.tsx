import React, { useMemo, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Brain,
  Cpu,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Unlock,
} from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'
import { formatNumber } from '@/lib/utils'

// Custom Node: Input Image
const InputNode = ({ data }: any) => (
  <div className="px-4 py-3 rounded-2xl bg-[#0d1321] border border-cyan-500/40 shadow-xl shadow-cyan-500/10 min-w-[170px] text-left">
    <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
      <ImageIcon className="w-3.5 h-3.5" />
      <span>Đầu vào (Input)</span>
    </div>
    <div className="text-xs font-bold text-slate-100">{data.label}</div>
    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
      Kích thước: {data.dim}
    </div>
    <Handle type="source" position={Position.Right} className="!bg-cyan-400 !w-2.5 !h-2.5" />
  </div>
)

// Custom Node: Backbone (Feature Extractor)
const BackboneNode = ({ data }: any) => (
  <div className={`px-4 py-3 rounded-2xl bg-[#0d1321] border ${data.frozen ? 'border-amber-500/40' : 'border-blue-500/40'} shadow-xl min-w-[210px] text-left`}>
    <Handle type="target" position={Position.Left} className="!bg-cyan-400 !w-2.5 !h-2.5" />
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1.5 text-blue-400 font-mono text-[10px] font-bold uppercase tracking-wider">
        <Brain className="w-3.5 h-3.5" />
        <span>Trích xuất đặc trưng</span>
      </div>
      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full flex items-center gap-1 ${
        data.frozen ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      }`}>
        {data.frozen ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
        <span>{data.frozen ? 'Đã đóng băng' : 'Học từ đầu'}</span>
      </span>
    </div>
    <div className="text-xs font-bold text-slate-100">{data.label}</div>
    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
      Vector đặc trưng: {data.featureDim}-D
    </div>
    <div className="text-[10px] font-mono text-slate-400">
      Tham số: {formatNumber(data.params, 0)}
    </div>
    <Handle type="source" position={Position.Right} className="!bg-purple-400 !w-2.5 !h-2.5" />
  </div>
)

// Custom Node: Classification Head
const HeadNode = ({ data }: any) => (
  <div className="px-4 py-3 rounded-2xl bg-[#0d1321] border border-purple-500/40 shadow-xl shadow-purple-500/10 min-w-[200px] text-left">
    <Handle type="target" position={Position.Left} className="!bg-purple-400 !w-2.5 !h-2.5" />
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1.5 text-purple-400 font-mono text-[10px] font-bold uppercase tracking-wider">
        <Layers className="w-3.5 h-3.5" />
        <span>Đầu phân loại (Head)</span>
      </div>
      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
        <Unlock className="w-2.5 h-2.5" />
        <span>Huấn luyện</span>
      </span>
    </div>
    <div className="text-xs font-bold text-slate-100">
      {data.denseLayers} Lớp Dense ({data.neurons} neurons)
    </div>
    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
      Kích hoạt: {data.activation.toUpperCase()} • Dropout: {data.dropout}
    </div>
    <div className="text-[10px] font-mono text-cyan-300">
      Tham số học: {formatNumber(data.trainableParams, 0)}
    </div>
    <Handle type="source" position={Position.Right} className="!bg-emerald-400 !w-2.5 !h-2.5" />
  </div>
)

// Custom Node: Output Classes
const OutputNode = ({ data }: any) => (
  <div className="px-4 py-3 rounded-2xl bg-[#0d1321] border border-emerald-500/40 shadow-xl shadow-emerald-500/10 min-w-[170px] text-left">
    <Handle type="target" position={Position.Left} className="!bg-emerald-400 !w-2.5 !h-2.5" />
    <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
      <Sparkles className="w-3.5 h-3.5" />
      <span>Xác suất đầu ra (Softmax)</span>
    </div>
    <div className="text-xs font-bold text-slate-100">{data.classCount} Lớp mục tiêu</div>
    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
      {data.classes.join(', ')}
    </div>
  </div>
)

const nodeTypes = {
  inputNode: InputNode,
  backboneNode: BackboneNode,
  headNode: HeadNode,
  outputNode: OutputNode,
}

export const NetworkVisualizer: React.FC = () => {
  const { config, dataset, paramEstimate, setSelectedLessonKey } = useLabStore()
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<string | null>(null)
  const [isSimulatingForward, setIsSimulatingForward] = useState(false)

  const isCustom = config.mode === 'advanced'
  const classes = dataset?.classes || []
  const classNames = classes.map((c) => c.name)

  const nodes: Node[] = useMemo(() => {
    return [
      {
        id: '1',
        type: 'inputNode',
        position: { x: 40, y: 80 },
        data: {
          label: 'Ảnh RGB đầu vào',
          dim: isCustom ? '64×64×3' : '224×224×3',
          info: 'Hình ảnh được tiền xử lý và chuẩn hóa theo thang chuẩn ImageNet (Mean & Standard Deviation) trước khi đưa vào mạng.',
        },
      },
      {
        id: '2',
        type: 'backboneNode',
        position: { x: 260, y: 70 },
        data: {
          label: isCustom ? 'Custom Convolutional Blocks' : 'MobileNetV3-Small',
          featureDim: isCustom ? 32 : 576,
          params: paramEstimate?.extractor_params || 927008,
          frozen: !isCustom,
          info: isCustom
            ? 'Các khối Conv3x3 + BatchNorm + Activation + MaxPool học cách phát hiện các cạnh, họa tiết và hình khối từ đầu.'
            : 'Mô hình đã học sẵn trên 1.4 triệu ảnh của ImageNet. Trọng số được đóng băng để giữ nguyên kiến thức thị giác tổng quát.',
        },
      },
      {
        id: '3',
        type: 'headNode',
        position: { x: 530, y: 70 },
        data: {
          denseLayers: config.dense_layers,
          neurons: config.neurons,
          activation: config.activation,
          dropout: config.dropout,
          trainableParams: paramEstimate?.head_params || 36930,
          info: 'Đầu phân loại (Classification Head) kết nối các đặc trưng hình ảnh với các lớp của bạn. Đây là phần duy nhất được cập nhật trọng số trong Transfer Learning.',
        },
      },
      {
        id: '4',
        type: 'outputNode',
        position: { x: 800, y: 80 },
        data: {
          classCount: Math.max(2, classNames.length),
          classes: classNames.length > 0 ? classNames : ['Lớp 1', 'Lớp 2'],
          info: 'Hàm kích hoạt Softmax chuyển đổi đầu ra tuyến tính thành phân phối xác suất từ 0% đến 100%, tổng bằng 100%.',
        },
      },
    ]
  }, [config, isCustom, classNames, paramEstimate])

  const edges: Edge[] = useMemo(() => {
    return [
      {
        id: 'e1-2',
        source: '1',
        target: '2',
        animated: isSimulatingForward,
        style: { stroke: isSimulatingForward ? '#00f0ff' : 'rgba(255,255,255,0.2)', strokeWidth: 2 },
      },
      {
        id: 'e2-3',
        source: '2',
        target: '3',
        animated: isSimulatingForward,
        style: { stroke: isSimulatingForward ? '#8b5cf6' : 'rgba(255,255,255,0.2)', strokeWidth: 2 },
      },
      {
        id: 'e3-4',
        source: '3',
        target: '4',
        animated: isSimulatingForward,
        style: { stroke: isSimulatingForward ? '#10b981' : 'rgba(255,255,255,0.2)', strokeWidth: 2 },
      },
    ]
  }, [isSimulatingForward])

  const triggerAnimation = () => {
    setIsSimulatingForward(true)
    setTimeout(() => setIsSimulatingForward(false), 2400)
  }

  return (
    <div className="h-full flex flex-col p-2 select-none relative">
      {/* Top Controls Toolbar */}
      <div className="flex items-center justify-between pb-2 px-1">
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-200">
            Sơ đồ Mạng Nơ-ron Tương tác (Architecture Visualizer)
          </div>
          <button
            onClick={() => setSelectedLessonKey('hidden_layer')}
            className="text-[10px] font-mono text-purple-300 hover:text-purple-200 underline flex items-center gap-1"
          >
            <HelpCircle className="w-3 h-3" />
            <span>Tìm hiểu Lớp ẩn</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Conceptual Animation Button */}
          <button
            onClick={triggerAnimation}
            disabled={isSimulatingForward}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition"
          >
            <Play className={`w-3.5 h-3.5 ${isSimulatingForward ? 'animate-spin' : ''}`} />
            <span>Mô phỏng Lan truyền xuôi (Forward Pass)</span>
          </button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 w-full rounded-2xl overflow-hidden border border-white/10 bg-[#080b12] relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNodeInfo(node.data?.info as string)}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="rgba(255,255,255,0.04)" gap={20} size={1} />
          <Controls className="!bg-[#0c1019] !border-white/10 !fill-white" />
        </ReactFlow>

        {/* Selected Node Educational Overlay */}
        {selectedNodeInfo && (
          <div className="absolute bottom-3 left-3 max-w-md p-3.5 rounded-xl bg-[#0c1019]/95 backdrop-blur border border-cyan-500/30 shadow-2xl text-xs space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between font-semibold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Giải thích thành phần</span>
              </span>
              <button
                onClick={() => setSelectedNodeInfo(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">{selectedNodeInfo}</p>
          </div>
        )}
      </div>
    </div>
  )
}
