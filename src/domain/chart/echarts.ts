import type { EChartsOption } from 'echarts'
import type { ChartConfig } from './types'
import type { DatasetCandidate } from '../data/types'
import { prepareAxisSeries, preparePieSeries, prepareScatterSeries } from './logic'

const palette = ['#2563eb', '#f97316', '#16a34a', '#9333ea', '#0891b2', '#dc2626']

export const createChartOption = (dataset: DatasetCandidate, config: ChartConfig): EChartsOption => {
  if (config.type === 'table') return {}
  if (config.type === 'pie' && config.pie) {
    return {
      color: palette,
      tooltip: { trigger: 'item' },
      legend: { type: 'scroll', bottom: 0 },
      series: [{ type: 'pie', radius: ['35%', '68%'], data: preparePieSeries(dataset.rows, config.pie.category, config.pie.value, config.pie.aggregation) }],
    }
  }
  if (config.type === 'scatter' && config.scatter) {
    return {
      color: palette,
      tooltip: { trigger: 'item' },
      legend: { top: 0 },
      grid: { left: 55, right: 24, top: 50, bottom: 70 },
      xAxis: { type: 'value', name: config.scatter.x },
      yAxis: { type: 'value', name: config.scatter.y },
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 18 }],
      toolbox: { right: 12, feature: { dataZoom: { yAxisIndex: 'none' }, restore: {} } },
      series: prepareScatterSeries(dataset.rows, config.scatter.x, config.scatter.y, config.scatter.series).map((series) => ({ ...series, type: 'scatter' })),
    }
  }
  if ((config.type === 'line' || config.type === 'bar') && config.axis) {
    const axis = config.axis
    const prepared = prepareAxisSeries(dataset.rows, axis.dimension, axis.values, axis.aggregation)
    return {
      color: palette,
      tooltip: { trigger: 'axis' },
      legend: { top: 0 },
      grid: { left: 55, right: 24, top: 50, bottom: 70 },
      xAxis: { type: axis.dateAxis ? 'time' : 'category', data: axis.dateAxis ? undefined : prepared.categories, boundaryGap: config.type === 'bar' },
      yAxis: { type: 'value' },
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 18 }],
      toolbox: { right: 12, feature: { dataZoom: { yAxisIndex: 'none' }, restore: {} } },
      series: prepared.series.map((series) => config.type === 'line'
        ? (axis.dateAxis
          ? { name: series.name, type: 'line' as const, showSymbol: axis.showDataPoints, data: prepared.categories.map((category, index) => [category, series.values[index]]) }
          : { name: series.name, type: 'line' as const, showSymbol: axis.showDataPoints, data: series.values })
        : (axis.dateAxis
          ? { name: series.name, type: 'bar' as const, data: prepared.categories.map((category, index) => [category, series.values[index]]) }
          : { name: series.name, type: 'bar' as const, data: series.values })),
    }
  }
  return {}
}
