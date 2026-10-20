import type { ParameterSpec } from '@/types/api'

type NumericSpec = Pick<ParameterSpec, 'type' | 'min' | 'max' | 'step' | 'scale'>

// Remove floating-point noise without losing small values such as 0.0005.
export const formatParameterNumber = (value: number) => String(Number(value.toPrecision(12)))

export function createNumericControl(spec: NumericSpec, value: number) {
  if (spec.scale === 'log' && spec.min != null && spec.max != null && spec.min > 0) {
    const ticks = [spec.min, spec.max]
    for (let exponent = Math.floor(Math.log10(spec.min)); exponent <= Math.ceil(Math.log10(spec.max)); exponent++) {
      for (let coefficient = 1; coefficient <= 9; coefficient++) {
        const tick = Number((coefficient * 10 ** exponent).toPrecision(12))
        if (tick > spec.min && tick < spec.max) ticks.push(tick)
      }
    }
    const values = [...new Set(ticks)].sort((a, b) => a - b)
    const position = values.reduce((best, tick, index) =>
      Math.abs(Math.log(tick / value)) < Math.abs(Math.log(values[best] / value)) ? index : best, 0)
    return {
      min: 0, max: values.length - 1, step: 1, value: position,
      fromSlider: (position: number) => values[position],
    }
  }
  return {
    min: spec.min, max: spec.max, step: spec.step ?? (spec.type === 'float' ? 0.001 : 1), value,
    fromSlider: (value: number) => Number(value.toPrecision(12)),
  }
}
