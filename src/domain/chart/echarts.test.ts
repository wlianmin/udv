import { describe, expect, it } from 'vitest'
import { createChartOption } from './echarts'
import { createDataset } from '../data/normalize'

const dataset = createDataset('x', '$', [{ label: 'A', value: 2 }, { label: 'B', value: 4 }])

describe('ECharts options', () => {
  it('maps the line data-point switch to showSymbol', () => {
    const hidden = createChartOption(dataset, {
      type: 'line',
      axis: { dimension: 'label', values: ['value'], dateAxis: false, aggregation: 'none', showDataPoints: false },
      visibleColumns: ['label', 'value'],
    })
    const shown = createChartOption(dataset, {
      type: 'line',
      axis: { dimension: 'label', values: ['value'], dateAxis: false, aggregation: 'none', showDataPoints: true },
      visibleColumns: ['label', 'value'],
    })

    expect((hidden.series as Array<{ showSymbol?: boolean }>)[0].showSymbol).toBe(false)
    expect((shown.series as Array<{ showSymbol?: boolean }>)[0].showSymbol).toBe(true)
  })
})
