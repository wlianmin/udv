import { describe, expect, it } from 'vitest'
import { prepareAxisSeries, preparePieSeries, validateChartConfig } from './logic'
import { createDataset } from '../data/normalize'

const dataset = createDataset('x', '$', [{ category: 'A', value: 2 }, { category: 'A', value: 4 }, { category: 'B', value: 3 }])

describe('chart logic', () => {
  it('aggregates repeated categories only when requested', () => {
    expect(prepareAxisSeries(dataset.rows, 'category', ['value'], 'sum').series[0].values).toEqual([6, 3])
    expect(prepareAxisSeries(dataset.rows, 'category', ['value'], 'none').series[0].values).toEqual([2, 4, 3])
    expect(preparePieSeries(dataset.rows, 'category', 'value', 'average')).toEqual([{ name: 'A', value: 3 }, { name: 'B', value: 3 }])
  })

  it('reports missing and wrong-type mappings', () => {
    const result = validateChartConfig(dataset, dataset.fields, { type: 'scatter', scatter: { x: 'category', y: '' }, visibleColumns: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('必须是数值字段')
  })
})
