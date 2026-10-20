import React from 'react'
import { BookOpen } from 'lucide-react'
import { useLabStore } from '@/store/useLabStore'
import type { ParameterSpec, TrainingConfigState } from '@/types/api'
import { createNumericControl, formatParameterNumber } from './numeric-control'
import { mergeTrainingConfig } from './training-config'

interface ParameterControlItemProps {
  spec: ParameterSpec
}

export const ParameterControlItem: React.FC<ParameterControlItemProps> = ({ spec }) => {
  const { config, updateConfig, setSelectedLessonKey, theme } = useLabStore()
  const value = config[spec.key as keyof TrainingConfigState]
  const numericControl = typeof value === 'number' ? createNumericControl(spec, value) : null
  const filters = spec.key === 'conv_filters' ? mergeTrainingConfig(config, {}).conv_filters : []

  const handleChange = (newVal: string | number | boolean) => {
    updateConfig({ [spec.key]: newVal })
  }

  return (
    <div className={`space-y-1.5 p-2.5 rounded-xl border transition group ${
      theme === 'light'
        ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
        : 'bg-white/[0.03] border-white/5 hover:border-white/10'
    }`}>
      {/* Label & Value row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
            {spec.name_vi}
          </span>
          <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-400'}`}>
            ({spec.name_en})
          </span>
          {spec.lesson && (
            <button
              onClick={() => setSelectedLessonKey(spec.lesson)}
              title="Tìm hiểu khái niệm này"
              className={theme === 'light' ? 'text-sky-600 hover:text-sky-800 transition' : 'text-cyan-400/80 hover:text-cyan-300 transition'}
            >
              <BookOpen className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Current Value Display */}
        <div className={`font-mono font-bold text-xs ${theme === 'light' ? 'text-sky-700' : 'text-cyan-300'}`}>
          {spec.type === 'bool'
            ? value ? 'BẬT' : 'TẮT'
            : spec.key === 'conv_filters' ? filters.join(', ')
            : typeof value === 'number'
            ? formatParameterNumber(value)
            : String(value).toUpperCase()}
        </div>
      </div>

      {/* Control Input */}
      <div>
        {(spec.type === 'int' || spec.type === 'float') && numericControl ? (
          <div className="flex items-center gap-2">
            <input
              type="range"
              aria-label={spec.name_vi}
              aria-valuetext={typeof value === 'number' ? formatParameterNumber(value) : undefined}
              min={numericControl.min}
              max={numericControl.max}
              step={numericControl.step}
              value={numericControl.value}
              onChange={(e) => handleChange(numericControl.fromSlider(Number(e.target.value)))}
              className={`w-full accent-cyan-500 h-2 rounded-lg cursor-pointer ${
                theme === 'light' ? 'bg-slate-200' : 'bg-white/10'
              }`}
            />
          </div>
        ) : spec.type === 'enum' ? (
          <div className="grid grid-cols-2 gap-1.5">
            {spec.options?.map((opt) => {
              const optVal = typeof opt === 'object' ? opt.value : opt
              const optLabel = typeof opt === 'object' ? opt.label : opt
              const active = value === optVal
              return (
                <button
                  key={optVal}
                  type="button"
                  onClick={() => handleChange(optVal)}
                  className={`py-1 px-2 rounded-lg text-[11px] font-medium transition ${
                    active
                      ? theme === 'light'
                        ? 'bg-sky-100 text-sky-800 border border-sky-300 font-bold shadow-sm'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : theme === 'light'
                      ? 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm'
                      : 'bg-black/30 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {optLabel}
                </button>
              )
            })}
          </div>
        ) : spec.type === 'int_list' && spec.key === 'conv_filters' ? (
          <div className="grid grid-cols-2 gap-2">
            {filters.map((filter, index) => (
              <label key={index} className="flex items-center gap-2 text-[11px]">
                <span className={theme === 'light' ? 'text-slate-600' : 'text-slate-400'}>Khối {index + 1}</span>
                <select
                  aria-label={`Số filter khối ${index + 1}`}
                  value={filter}
                  onChange={event => updateConfig({ conv_filters: filters.map((value, i) => i === index ? Number(event.target.value) : value) })}
                  className={`min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs ${theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0d1420] border-white/15 text-slate-200'}`}
                >
                  {spec.options?.map(option => {
                    const number = typeof option === 'number' ? option : Number(option.value)
                    return <option key={number} value={number}>{number}</option>
                  })}
                </select>
              </label>
            ))}
          </div>
        ) : spec.type === 'bool' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleChange(!value)}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                value ? 'bg-cyan-500' : theme === 'light' ? 'bg-slate-300' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  value ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-[11px] ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              {value ? 'Đang kích hoạt tăng cường dữ liệu' : 'Tắt (tính đặc trưng nhanh hơn)'}
            </span>
          </div>
        ) : null}
      </div>

      {/* Description / Tooltip */}
      <div className={`text-[10px] leading-normal ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
        {spec.description}
      </div>
    </div>
  )
}
