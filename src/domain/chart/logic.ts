import type { CellValue, DataRow, DatasetCandidate, FieldDescriptor } from '../data/types'
import type { Aggregation, ChartConfig, ChartValidationResult, PreparedSeries } from './types'

const asDisplayValue = (value: CellValue): string => {
  if (value === null || value === undefined) return '空值'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const asNumber = (value: CellValue): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const fieldByName = (fields: FieldDescriptor[], name: string | undefined) => fields.find((field) => field.name === name)

export const validateChartConfig = (dataset: DatasetCandidate, fields: FieldDescriptor[], config: ChartConfig): ChartValidationResult => {
  const errors: string[] = []
  const requireField = (name: string | undefined, label: string) => {
    if (!name) errors.push(`请选择${label}。`)
    else if (!fieldByName(fields, name)) errors.push(`${label}“${name}”已不存在，请重新选择。`)
  }
  const requireNumber = (name: string | undefined, label: string) => {
    requireField(name, label)
    const field = fieldByName(fields, name)
    if (field && field.type !== 'number') errors.push(`${label}必须是数值字段。`)
  }

  if (!dataset) errors.push('请先选择数据集。')
  if (config.type === 'line' || config.type === 'bar') {
    requireField(config.axis?.dimension, '维度/时间轴字段')
    if (!config.axis?.values?.length) errors.push('至少选择一个数值字段。')
    config.axis?.values?.forEach((name) => requireNumber(name, `数值字段“${name}”`))
  }
  if (config.type === 'scatter') {
    requireNumber(config.scatter?.x, 'X 轴字段')
    requireNumber(config.scatter?.y, 'Y 轴字段')
    if (config.scatter?.series) requireField(config.scatter.series, '系列字段')
  }
  if (config.type === 'pie') {
    requireField(config.pie?.category, '分类字段')
    requireNumber(config.pie?.value, '数值字段')
  }
  if (config.type === 'table' && config.visibleColumns.some((name) => !fieldByName(fields, name))) {
    errors.push('可见列配置包含已不存在的字段，请重新选择。')
  }
  return { valid: errors.length === 0, errors }
}

const aggregate = (values: number[], aggregation: Aggregation): number | null => {
  if (aggregation === 'count') return values.length
  if (values.length === 0) return null
  if (aggregation === 'sum') return values.reduce((total, value) => total + value, 0)
  if (aggregation === 'average') return values.reduce((total, value) => total + value, 0) / values.length
  if (aggregation === 'max') return Math.max(...values)
  if (aggregation === 'min') return Math.min(...values)
  return values[0] ?? null
}

export const prepareAxisSeries = (rows: DataRow[], dimension: string, values: string[], aggregation: Aggregation): PreparedSeries => {
  if (aggregation === 'none') {
    return {
      categories: rows.map((row) => asDisplayValue(row[dimension] ?? null)),
      series: values.map((name) => ({ name, values: rows.map((row) => asNumber(row[name] ?? null)) })),
    }
  }

  const grouped = new Map<string, DataRow[]>()
  rows.forEach((row) => {
    const key = asDisplayValue(row[dimension] ?? null)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  })
  const categories = [...grouped.keys()]
  return {
    categories,
    series: values.map((name) => ({
      name,
      values: categories.map((category) => aggregate(
        (grouped.get(category) ?? []).map((row) => asNumber(row[name] ?? null)).filter((value): value is number => value !== null),
        aggregation,
      )),
    })),
  }
}

export const preparePieSeries = (rows: DataRow[], category: string, value: string, aggregation: Exclude<Aggregation, 'none'>) => {
  const grouped = new Map<string, number[]>()
  rows.forEach((row) => {
    const key = asDisplayValue(row[category] ?? null)
    const numeric = asNumber(row[value] ?? null)
    if (aggregation === 'count') {
      grouped.set(key, [...(grouped.get(key) ?? []), 1])
    } else if (numeric !== null) {
      grouped.set(key, [...(grouped.get(key) ?? []), numeric])
    }
  })
  return [...grouped.entries()].map(([name, numbers]) => ({ name, value: aggregate(numbers, aggregation) ?? 0 }))
}

export const prepareScatterSeries = (rows: DataRow[], x: string, y: string, series?: string) => {
  const groups = new Map<string, Array<[number, number]>>()
  rows.forEach((row) => {
    const xValue = asNumber(row[x] ?? null)
    const yValue = asNumber(row[y] ?? null)
    if (xValue === null || yValue === null) return
    const group = series ? asDisplayValue(row[series] ?? null) : '数据'
    groups.set(group, [...(groups.get(group) ?? []), [xValue, yValue]])
  })
  return [...groups.entries()].map(([name, data]) => ({ name, data }))
}

export const valueForDisplay = asDisplayValue
