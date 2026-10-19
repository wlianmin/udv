import type { CellValue, DataRow, DatasetCandidate, FieldDescriptor, FieldType } from './types'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const flattenObject = (value: Record<string, unknown>, prefix = ''): DataRow => {
  const result: DataRow = {}
  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (isObject(child)) {
      Object.assign(result, flattenObject(child, path))
    } else if (Array.isArray(child)) {
      result[path] = child.map((item) => (isObject(item) ? JSON.stringify(item) : item)) as string[]
    } else if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean' || child === null) {
      result[path] = child
    } else {
      result[path] = JSON.stringify(child)
    }
  })
  return result
}

const inferFieldType = (values: CellValue[]): FieldType => {
  const present = values.filter((value) => value !== null && value !== '')
  if (present.length === 0) return 'string'
  if (present.every((value) => typeof value === 'number' && Number.isFinite(value))) return 'number'
  if (present.every((value) => typeof value === 'boolean')) return 'boolean'
  return 'string'
}

export const describeFields = (rows: DataRow[]): FieldDescriptor[] => {
  const names = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((name) => names.add(name)))
  const leafNames = [...names].filter((name) => ![...names].some((candidate) => candidate !== name && candidate.startsWith(`${name}.`)))
  return leafNames.map((name) => {
    const values = rows.map((row) => row[name] ?? null)
    return {
      name,
      type: inferFieldType(values),
      nullable: values.some((value) => value === null || value === ''),
      nonNullCount: values.filter((value) => value !== null && value !== '').length,
    }
  })
}

export const normalizeRows = (records: unknown[]): DataRow[] => records.map((record) => {
  if (isObject(record)) return flattenObject(record)
  return { value: record as CellValue }
})

export const createDataset = (id: string, path: string, records: unknown[], label = path): DatasetCandidate => {
  const rows = normalizeRows(records)
  const fields = describeFields(rows)
  const normalizedRows = rows.map((row) => fields.reduce<DataRow>((normalized, field) => {
    normalized[field.name] = row[field.name] ?? null
    return normalized
  }, {}))
  return {
    id,
    path,
    label,
    rows: normalizedRows,
    fields,
    recordCount: normalizedRows.length,
    preview: normalizedRows.slice(0, 100),
  }
}

export const createScalarDataset = (id: string, path: string, value: unknown): DatasetCandidate =>
  createDataset(id, path, [value], path)

export const flattenJsonObject = flattenObject
