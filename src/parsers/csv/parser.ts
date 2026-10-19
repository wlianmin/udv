import { createDataset } from '../../domain/data/normalize'
import { DataParseError, type ParsedSource } from '../../domain/data/types'
import type { DataSourceParser } from '../core/types'

const inferValue = (value: string) => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return value
}

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (quoted) throw new DataParseError('CSV 文件包含未闭合的引号。', [{ code: 'unclosed-quote', message: '请检查引号是否成对出现。' }])
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    if (row.some((value) => value !== '')) rows.push(row)
  }
  return rows
}

export const parseCsv = (text: string, fileName: string, fileSize: number): ParsedSource => {
  if (text.startsWith('\uFEFF')) text = text.slice(1)
  const rawRows = parseCsvRows(text)
  if (rawRows.length === 0) throw new DataParseError('CSV 文件为空。', [{ code: 'empty-csv', message: '请选择包含首行表头和数据行的 CSV 文件。' }])
  const headers = rawRows[0].map((header, index) => header.trim() || `column_${index + 1}`)
  const warnings: string[] = []
  const records = rawRows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) warnings.push(`第 ${rowIndex + 2} 行有 ${values.length} 列，表头有 ${headers.length} 列；缺失单元格已填充为空值，多余单元格已保留。`)
    const record = headers.reduce<Record<string, unknown>>((result, header, columnIndex) => {
      result[header] = inferValue(values[columnIndex] ?? '')
      return result
    }, {})
    values.slice(headers.length).forEach((value, extraIndex) => {
      record[`column_${headers.length + extraIndex + 1}`] = inferValue(value)
    })
    return record
  })
  return { format: 'csv', fileName, fileSize, datasets: [createDataset('csv', '$', records, 'CSV 数据')], warnings }
}

export const csvParser: DataSourceParser = {
  format: 'csv',
  accepts: (fileName, mimeType) => mimeType === 'text/csv' || /\.csv$/i.test(fileName),
  parse: parseCsv,
}
