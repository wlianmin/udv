import { createDataset, createScalarDataset } from '../../domain/data/normalize'
import { DataParseError, type ParsedSource } from '../../domain/data/types'
import type { DataSourceParser } from '../core/types'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const collectArrays = (value: unknown, path: string, results: Array<{ path: string; values: unknown[] }>) => {
  if (Array.isArray(value)) {
    results.push({ path, values: value })
    return
  }
  if (isObject(value)) {
    Object.entries(value).forEach(([key, child]) => collectArrays(child, path ? `${path}.${key}` : key, results))
  }
}

export const parseJson = (text: string, fileName: string, fileSize: number): ParsedSource => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new DataParseError('JSON 文件无法解析。', [{
      code: 'invalid-json',
      message: error instanceof Error ? error.message : 'JSON syntax error',
    }])
  }

  const datasets = []
  if (Array.isArray(parsed)) {
    datasets.push(createDataset('root', '$', parsed, '顶层数组'))
  } else if (isObject(parsed)) {
    const candidates: Array<{ path: string; values: unknown[] }> = []
    collectArrays(parsed, '$', candidates)
    if (candidates.length > 0) {
      candidates.forEach((candidate, index) => {
        datasets.push(createDataset(`candidate-${index}`, candidate.path, candidate.values, candidate.path))
      })
    } else {
      datasets.push(createDataset('root-object', '$', [parsed], '顶层对象'))
    }
  } else {
    datasets.push(createScalarDataset('root-value', '$', parsed))
  }

  return { format: 'json', fileName, fileSize, datasets, warnings: [] }
}

export const jsonParser: DataSourceParser = {
  format: 'json',
  accepts: (fileName, mimeType) => mimeType === 'application/json' || /\.json$/i.test(fileName),
  parse: parseJson,
}
