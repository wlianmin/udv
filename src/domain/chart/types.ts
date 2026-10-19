import type { DatasetCandidate, FieldDescriptor } from '../data/types'

export type ChartType = 'line' | 'bar' | 'scatter' | 'pie' | 'table'
export type Aggregation = 'none' | 'sum' | 'average' | 'max' | 'min' | 'count'

export interface AxisConfig {
  dimension: string
  values: string[]
  dateAxis: boolean
  aggregation: Aggregation
  showDataPoints: boolean
}

export interface ScatterConfig {
  x: string
  y: string
  series?: string
}

export interface PieConfig {
  category: string
  value: string
  aggregation: Exclude<Aggregation, 'none'>
}

export interface ChartConfig {
  type: ChartType
  axis?: AxisConfig
  scatter?: ScatterConfig
  pie?: PieConfig
  visibleColumns: string[]
}

export interface ChartValidationResult {
  valid: boolean
  errors: string[]
}

export interface PreparedSeries {
  categories: string[]
  series: Array<{ name: string; values: Array<number | null> }>
}

export interface ChartContext {
  dataset: DatasetCandidate
  fields: FieldDescriptor[]
}
