import React from 'react'
import { Flame, Sliders, Sparkles } from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'
import { ArchitectureCard } from './ArchitectureCard'
import { LiveTrainingStatus } from './LiveTrainingStatus'
import { ParameterControlItem } from './ParameterControlItem'

export const TrainingControl: React.FC = () => {
  const { config, paramSpecs } = useLabStore()

  // Filter specs appropriate for the active mode
  const visibleSpecs = paramSpecs.filter((s) => s.modes.includes(config.mode))

  return (
    <div className="h-full flex flex-col bg-[#07090e]/40 border-r border-white/10 select-none">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-100 flex items-center gap-2">
              <span>Huấn luyện Mô hình</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 capitalize">
                {config.mode}
              </span>
            </h2>
          </div>
        </div>
      </div>

      {/* Scrollable controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Architecture Summary */}
        <ArchitectureCard />

        {/* Hyperparameters Section */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1">
            Siêu tham số ({visibleSpecs.length} tham số)
          </div>

          <div className="space-y-2">
            {visibleSpecs.map((spec) => (
              <ParameterControlItem key={spec.key} spec={spec} />
            ))}
          </div>
        </div>

        {/* Live Status and Start/Cancel */}
        <div className="pt-2">
          <LiveTrainingStatus />
        </div>
      </div>
    </div>
  )
}
